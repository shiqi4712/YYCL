import { prisma } from '../middlewares/prisma'

export async function getTeacherHistory(teacherId: number, page: number, pageSize: number) {
  const [list, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { teacherId },
      include: { scenario: { select: { id: true, title: true, category: true } } },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.conversation.count({ where: { teacherId } })
  ])
  return { list, total }
}

export async function getTeacherOverview(teacherId: number) {
  const [totalCount, conversations] = await Promise.all([
    prisma.conversation.count({ where: { teacherId } }),
    prisma.conversation.findMany({
      where: { teacherId, finalScore: { not: null } },
      include: { scenario: { select: { category: true } } }
    })
  ])
  const scores = conversations.map(c => c.finalScore || 0)
  const coveredScenarios = new Set(conversations.map(c => c.scenarioId)).size

  const categoryBreakdown: Record<string, number> = {}
  for (const c of conversations) {
    const cat = c.scenario?.category || 'UNKNOWN'
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1
  }

  return {
    totalCount,
    totalDuration: conversations.length * 10 * 60, // mock: 10 min avg
    coveredScenarios,
    categoryBreakdown,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    highestScore: scores.length ? Math.max(...scores) : 0
  }
}

export async function getTeacherTrend(teacherId: number) {
  const conversations = await prisma.conversation.findMany({
    where: { teacherId, finalScore: { not: null } },
    orderBy: { startedAt: 'asc' },
    take: 30
  })
  return conversations.map(c => ({
    date: c.startedAt.toISOString().slice(0, 10),
    score: c.finalScore
  }))
}

export async function getTeacherRadar(teacherId: number) {
  // In MVP, return mock data based on latest review
  const latest = await prisma.conversation.findFirst({
    where: { teacherId, aiReview: { not: null } },
    orderBy: { startedAt: 'desc' }
  })
  if (latest?.aiReview) {
    try {
      const review = JSON.parse(latest.aiReview)
      const dims = review.dimensions || {}
      return {
        emotionComfort: dims.emotionComfort?.score || 60,
        valueDelivery: dims.valueDelivery?.score || 60,
        objectionHandling: dims.objectionHandling?.score || 60,
        closingAbility: dims.closingAbility?.score || 60,
        compliance: dims.compliance?.score || 60
      }
    } catch {
      // fallback
    }
  }
  return {
    emotionComfort: 60,
    valueDelivery: 60,
    objectionHandling: 60,
    closingAbility: 60,
    compliance: 60
  }
}

export async function getTeamOverview() {
  const totalTeachers = await prisma.user.count({ where: { role: 'TEACHER' } })
  const totalConversations = await prisma.conversation.count()
  const avgScore = await prisma.conversation.aggregate({
    _avg: { finalScore: true },
    where: { finalScore: { not: null } }
  })
  return {
    totalTeachers,
    totalConversations,
    averageScore: Math.round(avgScore._avg.finalScore || 0),
    activeTeachers: totalTeachers // simplified
  }
}