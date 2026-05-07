import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../middlewares/prisma'

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) throw { status: 401, message: '用户不存在' }
  if (user.status !== 'ACTIVE') throw { status: 403, message: '账号已被禁用' }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw { status: 401, message: '密码错误' }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )

  return { token, user: { id: user.id, username: user.username, role: user.role, realName: user.realName } }
}

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, role: true, realName: true, status: true, createdAt: true }
  })
  if (!user) throw { status: 404, message: '用户不存在' }
  return user
}