import { existsSync } from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../prisma/.env'),
]

for (const file of envCandidates) {
  if (existsSync(file)) {
    dotenv.config({ path: file })
  }
}

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function numberInRange(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export const env = {
  port: Number(process.env.PORT ?? 3101),
  jwtSecret: required('JWT_SECRET', 'yycl-v2-dev-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  appName: process.env.APP_NAME ?? 'YYCL V2 API',
  publicUrl: process.env.PUBLIC_URL ?? 'http://127.0.0.1:3101',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  authSessionHours: numberInRange(process.env.AUTH_SESSION_HOURS, 12, 1, 168),
  internalAccount: {
    appId: process.env.INTERNAL_ACCOUNT_APP_ID ?? '',
    loginUrlTemplate: process.env.INTERNAL_ACCOUNT_LOGIN_URL_TEMPLATE ?? '',
    authCodeUrl:
      process.env.INTERNAL_ACCOUNT_AUTH_CODE_URL ??
      'https://internal-account-api.codemao.cn/auth/login/auth-code',
    infoUrl:
      process.env.INTERNAL_ACCOUNT_INFO_URL ??
      'https://internal-account-api.codemao.cn/auth/info',
    callbackUrl: process.env.INTERNAL_ACCOUNT_CALLBACK_URL ?? '',
    codeParam: process.env.INTERNAL_ACCOUNT_CODE_PARAM ?? '',
    stateParam: process.env.INTERNAL_ACCOUNT_STATE_PARAM ?? '',
    credentialJsonPath: process.env.INTERNAL_ACCOUNT_CREDENTIAL_JSON_PATH ?? '',
    credentialHeader: process.env.INTERNAL_ACCOUNT_CREDENTIAL_HEADER ?? '',
    credentialPrefix: process.env.INTERNAL_ACCOUNT_CREDENTIAL_PREFIX ?? '',
  },
}
