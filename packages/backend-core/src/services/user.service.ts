import bcrypt from 'bcryptjs'
import { prisma } from '../middlewares/prisma'

export async function createTeacher(data: { username: string; password: string; realName?: string }, trainerId: number) {
  const existing = await prisma.user.findUnique({ where: { username: data.username } })
  if (existing) throw { status: 400, message: '用户名已存在' }

  const passwordHash = await bcrypt.hash(data.password, 10)
  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash,
      role: 'TEACHER',
      realName: data.realName || data.username,
      status: 'ACTIVE'
    }
  })

  await prisma.teacher.create({
    data: { userId: user.id, createdBy: trainerId }
  })

  return { id: user.id, username: user.username, realName: user.realName, status: user.status }
}

export async function listTeachers() {
  const teachers = await prisma.teacher.findMany({
    include: {
      user: {
        select: { id: true, username: true, realName: true, status: true, createdAt: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  return teachers.map(t => ({
    id: t.user.id,
    username: t.user.username,
    realName: t.user.realName,
    status: t.user.status,
    createdAt: t.createdAt
  }))
}

export async function updateTeacherStatus(id: number, status: string) {
  const user = await prisma.user.update({
    where: { id },
    data: { status },
    select: { id: true, username: true, realName: true, status: true }
  })
  return user
}