import { randomBytes } from 'node:crypto'
import { env } from '../env'
import { hashPassword } from '../lib/auth'
import { prisma } from '../lib/prisma'
import { createSiteSession, hashToken, randomToken } from '../lib/site-session'
import { HttpError } from '../utils/http-error'

type InternalAccountUser = {
  id: string
  fullname: string
}

function internalConfig() {
  const config = env.internalAccount
  const requiredValues = [
    ['INTERNAL_ACCOUNT_APP_ID', config.appId],
    ['INTERNAL_ACCOUNT_LOGIN_URL_TEMPLATE', config.loginUrlTemplate],
    ['INTERNAL_ACCOUNT_CALLBACK_URL', config.callbackUrl],
    ['INTERNAL_ACCOUNT_CODE_PARAM', config.codeParam],
    ['INTERNAL_ACCOUNT_STATE_PARAM', config.stateParam],
    ['INTERNAL_ACCOUNT_CREDENTIAL_JSON_PATH', config.credentialJsonPath],
    ['INTERNAL_ACCOUNT_CREDENTIAL_HEADER', config.credentialHeader],
  ]
  const missing = requiredValues.filter(([, value]) => !value).map(([name]) => name)

  if (missing.length) {
    throw new HttpError(503, '内部账号登录尚未配置，请联系管理员')
  }
  if (!config.loginUrlTemplate.includes('{callbackUrl}') || !config.loginUrlTemplate.includes('{state}')) {
    throw new HttpError(503, '内部账号登录地址模板必须包含 {callbackUrl} 和 {state}')
  }

  return config
}

export function normalizeReturnTo(value: unknown) {
  const returnTo = typeof value === 'string' ? value.trim() : '/'
  if (
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.includes('\\') ||
    /[\r\n]/.test(returnTo) ||
    returnTo.length > 500
  ) return '/'
  return returnTo
}

function readJsonPath(value: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, value)
}

export function renderLoginUrl(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (url, [key, value]) => url.split(`{${key}}`).join(encodeURIComponent(value)),
    template
  )
}

async function requestJson(url: string, init: RequestInit, purpose: string) {
  console.info(`Requesting internal account ${purpose}`, { endpoint: url })
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(12_000),
  })
  console.info(`Requested internal account ${purpose}`, { status: response.status })

  if (!response.ok) {
    throw new HttpError(502, '内部账号服务暂时不可用，请稍后重试')
  }
  return response.json() as Promise<unknown>
}

async function exchangeCode(code: string) {
  const config = internalConfig()
  const exchange = await requestJson(
    config.authCodeUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, appId: config.appId }),
    },
    'authorization code exchange'
  )
  const credential = readJsonPath(exchange, config.credentialJsonPath)
  if (typeof credential !== 'string' || !credential) {
    throw new HttpError(502, '内部账号返回格式与当前配置不一致')
  }

  const userPayload = await requestJson(
    config.infoUrl,
    {
      method: 'GET',
      headers: {
        [config.credentialHeader]: `${config.credentialPrefix}${credential}`,
      },
    },
    'current user information'
  )
  const userRecord = userPayload && typeof userPayload === 'object'
    ? (userPayload as Record<string, unknown>)
    : null
  const rawId = userRecord?.id
  const rawFullname = userRecord?.fullname
  const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId).trim() : ''
  const fullname = typeof rawFullname === 'string' ? rawFullname.trim() : ''

  if (!id || !fullname || id.length > 64 || fullname.length > 191) {
    throw new HttpError(502, '内部账号未返回有效的老师身份')
  }

  return { id, fullname } satisfies InternalAccountUser
}

async function resolveTeacher(internalUser: InternalAccountUser) {
  const existing = await prisma.user.findUnique({
    where: { internalAccountId: internalUser.id },
  })

  if (existing && existing.role !== 'TEACHER') {
    throw new HttpError(403, '管理员请使用系统账号登录管理后台')
  }
  if (existing && (!existing.isActive || existing.deletedAt)) {
    throw new HttpError(403, '老师账号已停用，请联系管理员')
  }
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { displayName: internalUser.fullname },
    })
  }

  const passwordHash = await hashPassword(randomBytes(32).toString('hex'))
  const username = `internal_${internalUser.id}`
  const usernameOwner = await prisma.user.findUnique({ where: { username } })
  if (usernameOwner) {
    throw new HttpError(409, '内部账号与现有账号冲突，请联系管理员')
  }

  return prisma.user.create({
    data: {
      username,
      passwordHash,
      role: 'TEACHER',
      displayName: internalUser.fullname,
      authProvider: 'INTERNAL_ACCOUNT',
      internalAccountId: internalUser.id,
      isActive: true,
    },
  })
}

export async function beginInternalLogin(returnToValue: unknown) {
  const config = internalConfig()
  const state = randomToken()
  const stateHash = hashToken(state)
  const returnTo = normalizeReturnTo(returnToValue)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.internalLoginAttempt.create({
    data: { stateHash, returnTo, expiresAt },
  })
  await prisma.internalLoginAttempt.deleteMany({ where: { expiresAt: { lt: new Date() } } })

  return {
    state,
    url: renderLoginUrl(config.loginUrlTemplate, {
      appId: config.appId,
      callbackUrl: config.callbackUrl,
      state,
    }),
  }
}

export function readInternalCallback(query: Record<string, unknown>) {
  const config = internalConfig()
  const codeValue = query[config.codeParam]
  const stateValue = query[config.stateParam]
  const code = typeof codeValue === 'string' ? codeValue.trim() : ''
  const state = typeof stateValue === 'string' ? stateValue.trim() : ''
  if (!code || !state) {
    throw new HttpError(400, '登录回调参数不完整')
  }
  return { code, state }
}

export async function completeInternalLogin(code: string, state: string) {
  const stateHash = hashToken(state)
  const attempt = await prisma.internalLoginAttempt.findUnique({ where: { stateHash } })
  if (!attempt || attempt.usedAt || attempt.expiresAt <= new Date()) {
    throw new HttpError(400, '登录请求已失效，请重新登录')
  }

  const claimed = await prisma.internalLoginAttempt.updateMany({
    where: { stateHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  })
  if (claimed.count !== 1) {
    throw new HttpError(400, '登录请求已使用，请重新登录')
  }

  const internalUser = await exchangeCode(code)
  const teacher = await resolveTeacher(internalUser)
  const session = await createSiteSession(teacher.id)

  return { session, returnTo: attempt.returnTo }
}
