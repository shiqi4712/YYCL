import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { comparePassword, hashPassword, signToken } from '../lib/auth'
import { prisma } from '../lib/prisma'
import type { UserRole } from '../types'
import { HttpError } from '../utils/http-error'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
})

const internalLoginSchema = z.object({
  id: z.coerce.number().int().positive().safe(),
  fullname: z.string().trim().min(1).max(80),
}).strict()

function createAuthResult(user: {
  id: string
  username: string
  role: string
  displayName: string | null
}) {
  const authUser = {
    id: user.id,
    username: user.username,
    role: user.role as UserRole,
    displayName: user.displayName,
  }

  return {
    token: signToken(authUser),
    user: authUser,
  }
}

export async function login(payload: unknown) {
  const { username, password } = loginSchema.parse(payload)

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !user.isActive) {
    throw new HttpError(401, '账号或密码错误')
  }

  const matched = await comparePassword(password, user.passwordHash)
  if (!matched) {
    throw new HttpError(401, '账号或密码错误')
  }

  return createAuthResult(user)
}

export async function loginWithInternalAccount(payload: unknown) {
  const input = internalLoginSchema.parse(payload)
  const username = `internal_${input.id}`
  const existing = await prisma.user.findUnique({ where: { username } })

  if (existing && existing.role !== 'TEACHER') {
    throw new HttpError(403, '该内部账号不能登录老师端')
  }
  if (existing && (!existing.isActive || existing.deletedAt)) {
    throw new HttpError(403, '老师账号已停用，请联系管理员')
  }

  const passwordHash = existing
    ? undefined
    : await hashPassword(randomBytes(32).toString('hex'))
  const user = await prisma.user.upsert({
    where: { username },
    update: {
      displayName: input.fullname,
    },
    create: {
      username,
      passwordHash: passwordHash!,
      role: 'TEACHER',
      displayName: input.fullname,
      isActive: true,
    },
  })

  return createAuthResult(user)
}
