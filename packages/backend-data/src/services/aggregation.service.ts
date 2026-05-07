import axios from 'axios'

const CORE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3001'
const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002'

// Helper to call core service with auth (using a service token or bypassing auth in dev)
async function coreGet(path: string, params?: any) {
  const res = await axios.get(`${CORE_URL}${path}`, { params })
  return res.data.data
}

export async function getTeacherOverview(teacherId: number) {
  return coreGet('/api/stats/teacher/overview', { teacherId })
}

export async function getTeacherTrend(teacherId: number) {
  return coreGet('/api/stats/teacher/trend', { teacherId })
}

export async function getTeacherRadar(teacherId: number) {
  return coreGet('/api/stats/teacher/radar', { teacherId })
}

export async function getTeacherHistory(teacherId: number, page: number, pageSize: number) {
  return coreGet('/api/stats/teacher/history', { teacherId, page, pageSize })
}

export async function getTeamOverview() {
  return coreGet('/api/stats/team/overview')
}

export async function getPracticeHeatmap() {
  // Aggregate scenario category distribution from all conversations
  const teachers = await coreGet('/api/users/teachers')
  const heatmap: Record<string, number> = {
    PRICE: 0, EFFECT: 0, TIME: 0, DECISION: 0, TRUST: 0
  }

  for (const teacher of teachers) {
    try {
      const history = await coreGet('/api/stats/teacher/history', { teacherId: teacher.id, page: 1, pageSize: 100 })
      for (const conv of history.list || []) {
        if (conv.scenario?.category) {
          heatmap[conv.scenario.category] = (heatmap[conv.scenario.category] || 0) + 1
        }
      }
    } catch {
      // ignore individual failures
    }
  }

  return Object.entries(heatmap).map(([category, count]) => ({ category, count }))
}

export async function getTeamRanking() {
  const teachers = await coreGet('/api/users/teachers')
  const rankings = []

  for (const teacher of teachers) {
    try {
      const overview = await coreGet('/api/stats/teacher/overview', { teacherId: teacher.id })
      rankings.push({
        teacherId: teacher.id,
        name: teacher.realName || teacher.username,
        averageScore: overview.averageScore || 0,
        totalCount: overview.totalCount || 0,
        coveredScenarios: overview.coveredScenarios || 0
      })
    } catch {
      // ignore
    }
  }

  return rankings.sort((a: any, b: any) => b.averageScore - a.averageScore)
}

export async function generateTeamReport(startDate?: string, endDate?: string) {
  const overview = await getTeamOverview()
  const ranking = await getTeamRanking()
  const heatmap = await getPracticeHeatmap()

  return {
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate },
    overview,
    ranking: ranking.slice(0, 10),
    heatmap
  }
}

export async function exportTeamReport(startDate?: string, endDate?: string, format: string = 'json') {
  const report = await generateTeamReport(startDate, endDate)

  if (format === 'csv') {
    const headers = '教师姓名,平均评分,练习次数,覆盖场景\n'
    const rows = report.ranking.map((r: any) => `${r.name},${r.averageScore},${r.totalCount},${r.coveredScenarios}`).join('\n')
    return '﻿' + headers + rows
  }

  return report
}

export async function compareTeachers(teacherIds: number[]) {
  const comparisons = []

  for (const id of teacherIds) {
    try {
      const [overview, radar] = await Promise.all([
        coreGet('/api/stats/teacher/overview', { teacherId: id }),
        coreGet('/api/stats/teacher/radar', { teacherId: id })
      ])
      comparisons.push({ teacherId: id, overview, radar })
    } catch {
      // ignore
    }
  }

  return comparisons
}

export async function analyzeCommonIssues(startDate?: string, endDate?: string) {
  // Collect recent low-scoring reviews and ask AI to summarize common issues
  const teachers = await coreGet('/api/users/teachers')
  const lowScoreConversations: any[] = []

  for (const teacher of teachers.slice(0, 5)) {
    try {
      const history = await coreGet('/api/stats/teacher/history', { teacherId: teacher.id, page: 1, pageSize: 20 })
      for (const conv of history.list || []) {
        if (conv.finalScore && conv.finalScore < 70) {
          lowScoreConversations.push(conv)
        }
      }
    } catch {
      // ignore
    }
  }

  if (lowScoreConversations.length === 0) {
    return { issues: [], sampleSize: 0 }
  }

  // In MVP, return a simple heuristic analysis instead of calling AI
  const categoryIssues: Record<string, { count: number; avgScore: number }> = {}

  for (const conv of lowScoreConversations) {
    const cat = conv.scenario?.category || 'UNKNOWN'
    if (!categoryIssues[cat]) {
      categoryIssues[cat] = { count: 0, avgScore: 0 }
    }
    categoryIssues[cat].count++
    categoryIssues[cat].avgScore += conv.finalScore || 0
  }

  const issues = Object.entries(categoryIssues).map(([category, data]) => ({
    category,
    count: data.count,
    avgScore: Math.round(data.avgScore / data.count),
    suggestion: `${category}类异议的低分对话较多，建议加强该场景专项训练`
  }))

  return { issues, sampleSize: lowScoreConversations.length }
}