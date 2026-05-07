import { prisma } from '../middlewares/prisma'

export async function createScript(data: any, userId: number) {
  return prisma.script.create({
    data: {
      category: data.category,
      title: data.title,
      content: data.content,
      keyPoints: data.keyPoints,
      createdBy: userId
    }
  })
}

export async function listScripts(filters: { category?: string; keyword?: string }) {
  const where: any = { status: 'ACTIVE' }
  if (filters.category) where.category = filters.category
  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword } },
      { content: { contains: filters.keyword } }
    ]
  }
  return prisma.script.findMany({ where, orderBy: { createdAt: 'desc' } })
}

export async function updateScript(id: number, data: any) {
  return prisma.script.update({
    where: { id },
    data: {
      category: data.category,
      title: data.title,
      content: data.content,
      keyPoints: data.keyPoints
    }
  })
}

export async function deleteScript(id: number) {
  return prisma.script.delete({ where: { id } })
}

export async function updateStatus(id: number, status: string) {
  return prisma.script.update({ where: { id }, data: { status } })
}

export async function favorite(scriptId: number, teacherId: number) {
  return prisma.teacherFavorite.create({
    data: { teacherId, scriptId },
    catch: () => null
  })
}

export async function unfavorite(scriptId: number, teacherId: number) {
  return prisma.teacherFavorite.deleteMany({
    where: { teacherId, scriptId }
  })
}

export async function listFavorites(teacherId: number) {
  const favorites = await prisma.teacherFavorite.findMany({
    where: { teacherId },
    include: { script: true }
  })
  return favorites.map(f => ({ ...f.script, isFavorited: true }))
}