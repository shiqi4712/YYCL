import { prisma } from '../middlewares/prisma'

export async function createScenario(data: any, userId: number) {
  return prisma.scenario.create({
    data: {
      title: data.title,
      category: data.category,
      parentProfile: data.parentProfile,
      initialMessage: data.initialMessage,
      difficulty: data.difficulty,
      recommendedScripts: data.recommendedScripts ? JSON.stringify(data.recommendedScripts) : null,
      createdBy: userId
    }
  })
}

export async function listScenarios(filters: { category?: string; difficulty?: string }) {
  const where: any = { status: 'ACTIVE' }
  if (filters.category) where.category = filters.category
  if (filters.difficulty) where.difficulty = filters.difficulty
  return prisma.scenario.findMany({ where, orderBy: { createdAt: 'desc' } })
}

export async function getScenario(id: number) {
  const s = await prisma.scenario.findUnique({ where: { id } })
  if (!s) throw { status: 404, message: '场景不存在' }
  return {
    ...s,
    recommendedScripts: s.recommendedScripts ? JSON.parse(s.recommendedScripts) : []
  }
}

export async function updateScenario(id: number, data: any) {
  return prisma.scenario.update({
    where: { id },
    data: {
      title: data.title,
      category: data.category,
      parentProfile: data.parentProfile,
      initialMessage: data.initialMessage,
      difficulty: data.difficulty,
      recommendedScripts: data.recommendedScripts ? JSON.stringify(data.recommendedScripts) : undefined
    }
  })
}

export async function deleteScenario(id: number) {
  return prisma.scenario.delete({ where: { id } })
}

export async function updateStatus(id: number, status: string) {
  return prisma.scenario.update({ where: { id }, data: { status } })
}