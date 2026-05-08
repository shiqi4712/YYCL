import { prisma } from '../middlewares/prisma'
import { cache, cacheKey } from '../middlewares/cache'
import { deepseekChatJson } from './deepseek.service'

// ==================== Teacher Personal Stats ====================

export async function getTeacherOverview(teacherId: number) {
  const ck = cacheKey('teacher:overview', { teacherId })
  const cached = cache.get(ck)
  if (cached) return cached

  const [totalCount, scoredConversations] = await Promise.all([
    prisma.conversation.count({ where: { teacherId } }),
    prisma.conversation.findMany({
      where: { teacherId, finalScore: { not: null } },
      include: { scenario: { select: { category: true } } },
    }),
  ])

  const scores = scoredConversations.map(c => c.finalScore || 0)
  const coveredScenarios = new Set(scoredConversations.map(c => c.scenarioId)).size

  const categoryBreakdown: Record<string, number> = {}
  for (const c of scoredConversations) {
    const cat = c.scenario?.category || 'UNKNOWN'
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1
  }

  const result = {
    totalCount,
    totalDuration: scoredConversations.length * 10 * 60,
    coveredScenarios,
    categoryBreakdown,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    highestScore: scores.length ? Math.max(...scores) : 0,
  }

  cache.set(ck, result)
  return result
}

export async function getTeacherTrend(teacherId: number) {
  const ck = cacheKey('teacher:trend', { teacherId })
  const cached = cache.get(ck)
  if (cached) return cached

  const conversations = await prisma.conversation.findMany({
    where: { teacherId, finalScore: { not: null } },
    orderBy: { startedAt: 'asc' },
    take: 30,
    select: { startedAt: true, finalScore: true },
  })

  const result = conversations.map(c => ({
    date: c.startedAt.toISOString().slice(0, 10),
    score: c.finalScore,
  }))

  cache.set(ck, result)
  return result
}

export async function getTeacherRadar(teacherId: number) {
  const ck = cacheKey('teacher:radar', { teacherId })
  const cached = cache.get(ck)
  if (cached) return cached

  const latest = await prisma.conversation.findFirst({
    where: { teacherId, aiReview: { not: null } },
    orderBy: { startedAt: 'desc' },
    select: { aiReview: true },
  })

  let result: Record<string, number>
  if (latest?.aiReview) {
    try {
      const review = JSON.parse(latest.aiReview)
      const dims = review.dimensions || {}
      result = {
        emotionComfort: dims.emotionComfort?.score || 60,
        valueDelivery: dims.valueDelivery?.score || 60,
        objectionHandling: dims.objectionHandling?.score || 60,
        closingAbility: dims.closingAbility?.score || 60,
        compliance: dims.compliance?.score || 60,
      }
    } catch {
      result = defaultRadar()
    }
  } else {
    result = defaultRadar()
  }

  cache.set(ck, result)
  return result
}

function defaultRadar() {
  return {
    emotionComfort: 60,
    valueDelivery: 60,
    objectionHandling: 60,
    closingAbility: 60,
    compliance: 60,
  }
}

export async function getTeacherHistory(teacherId: number, page: number, pageSize: number) {
  const [list, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { teacherId },
      include: { scenario: { select: { id: true, title: true, category: true } } },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.conversation.count({ where: { teacherId } }),
  ])
  return { list, total }
}

// ==================== Team Stats ====================

export async function getTeamOverview() {
  const ck = cacheKey('team:overview', {})
  const cached = cache.get(ck)
  if (cached) return cached

  const [totalTeachers, totalConversations, avgScoreAgg, activeTeachers] = await Promise.all([
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.conversation.count(),
    prisma.conversation.aggregate({
      _avg: { finalScore: true },
      where: { finalScore: { not: null } },
    }),
    prisma.user.count({ where: { role: 'TEACHER', status: 'ACTIVE' } }),
  ])

  const result = {
    totalTeachers,
    totalConversations,
    averageScore: Math.round(avgScoreAgg._avg.finalScore || 0),
    activeTeachers,
  }

  cache.set(ck, result)
  return result
}

export async function getPracticeHeatmap() {
  const ck = cacheKey('team:heatmap', {})
  const cached = cache.get(ck)
  if (cached) return cached

  const [scenarios, convGroups] = await Promise.all([
    prisma.scenario.findMany({ select: { id: true, category: true } }),
    prisma.conversation.groupBy({
      by: ['scenarioId'],
      _count: { id: true },
    }),
  ])

  const scenarioCategoryMap = new Map(scenarios.map(s => [s.id, s.category]))
  const heatmap: Record<string, number> = {
    PRICE: 0, EFFECT: 0, TIME: 0, DECISION: 0, TRUST: 0,
  }

  for (const g of convGroups) {
    const cat = scenarioCategoryMap.get(g.scenarioId)
    if (cat) {
      heatmap[cat] = (heatmap[cat] || 0) + g._count.id
    }
  }

  const result = Object.entries(heatmap).map(([category, count]) => ({ category, count }))
  cache.set(ck, result)
  return result
}

export async function getTeamRanking() {
  const ck = cacheKey('team:ranking', {})
  const cached = cache.get(ck)
  if (cached) return cached

  const rankingsAgg = await prisma.conversation.groupBy({
    by: ['teacherId'],
    _avg: { finalScore: true },
    _count: { id: true },
    where: { finalScore: { not: null } },
  })

  const teacherIds = rankingsAgg.map(r => r.teacherId)
  const users = await prisma.user.findMany({
    where: { id: { in: teacherIds } },
    select: { id: true, realName: true, username: true },
  })

  const userMap = new Map(users.map(u => [u.id, u]))

  const result = rankingsAgg
    .map(r => ({
      teacherId: r.teacherId,
      name: userMap.get(r.teacherId)?.realName || userMap.get(r.teacherId)?.username || `教师${r.teacherId}`,
      averageScore: Math.round(r._avg.finalScore || 0),
      totalCount: r._count.id,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)

  cache.set(ck, result)
  return result
}

export async function generateTeamReport(startDate?: string, endDate?: string) {
  const ck = cacheKey('team:report', { startDate, endDate })
  const cached = cache.get(ck)
  if (cached) return cached

  const [overview, ranking, heatmap] = await Promise.all([
    getTeamOverview(),
    getTeamRanking(),
    getPracticeHeatmap(),
  ])

  const result = {
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate },
    overview,
    ranking: ranking.slice(0, 10),
    heatmap,
  }

  cache.set(ck, result)
  return result
}

export async function exportTeamReport(startDate?: string, endDate?: string, format: string = 'json') {
  const report = await generateTeamReport(startDate, endDate)

  if (format === 'csv') {
    const headers = '教师姓名,平均评分,练习次数\n'
    const rows = report.ranking.map((r: any) => `${r.name},${r.averageScore},${r.totalCount}`).join('\n')
    return '﻿' + headers + rows
  }

  return report
}

export async function compareTeachers(teacherIds: number[]) {
  const comparisons = await Promise.all(
    teacherIds.map(async id => {
      const [overview, radar] = await Promise.all([
        getTeacherOverview(id),
        getTeacherRadar(id),
      ])
      return { teacherId: id, overview, radar }
    })
  )
  return comparisons
}

export async function analyzeCommonIssues(startDate?: string, endDate?: string) {
  const ck = cacheKey('team:issues', { startDate, endDate })
  const cached = cache.get(ck)
  if (cached) return cached

  const where: any = { finalScore: { not: null, lt: 70 } }
  if (startDate || endDate) {
    where.startedAt = {}
    if (startDate) where.startedAt.gte = new Date(startDate)
    if (endDate) where.startedAt.lte = new Date(endDate)
  }

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: 30,
    include: {
      scenario: { select: { title: true, category: true } },
      messages: { orderBy: { createdAt: 'asc' }, take: 10 },
    },
  })

  if (conversations.length === 0) {
    return { issues: [], sampleSize: 0 }
  }

  const transcripts = conversations.map(
    c =>
      `场景[${c.scenario?.category}] ${c.scenario?.title} (得分${c.finalScore}):\n${c.messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n')}`
  )

  try {
    const analysis = await deepseekChatJson(
      [
        {
          role: 'system',
          content:
            '你是一位资深销售培训专家。请分析以下低分对话（评分<70），提炼教师在异议处理中的共性问题。要求：1. 列出2-5个最主要的共性问题；2. 每个问题给出：问题描述、涉及场景分类、改进建议；3. 输出严格JSON格式: {"issues":[{"issue":"问题描述","categories":["分类"],"suggestion":"改进建议"}]}',
        },
        { role: 'user', content: transcripts.join('\n\n---\n\n') },
      ],
      0.5
    )

    const result = { issues: analysis.issues || [], sampleSize: conversations.length }
    cache.set(ck, result)
    return result
  } catch {
    const categoryIssues: Record<string, { count: number; avgScore: number }> = {}
    for (const conv of conversations) {
      const cat = conv.scenario?.category || 'UNKNOWN'
      if (!categoryIssues[cat]) categoryIssues[cat] = { count: 0, avgScore: 0 }
      categoryIssues[cat].count++
      categoryIssues[cat].avgScore += conv.finalScore || 0
    }

    const issues = Object.entries(categoryIssues).map(([category, data]) => ({
      issue: `${category}类异议的低分对话较多`,
      categories: [category],
      suggestion: `建议加强${category}类场景的专项训练，重点复盘典型低分对话`,
    }))

    const result = { issues, sampleSize: conversations.length }
    cache.set(ck, result)
    return result
  }
}
