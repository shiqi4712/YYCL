import { z } from 'zod'
import { comparePassword, signToken } from '../lib/auth'
import { prisma } from '../lib/prisma'
import type { UserRole } from '../types'
import { HttpError } from '../utils/http-error'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
})

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
