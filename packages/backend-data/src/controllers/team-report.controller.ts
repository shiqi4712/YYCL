import type { Request, Response } from 'express'
import * as aggregationService from '../services/aggregation.service'

export async function getTeamOverview(req: Request, res: Response) {
  const result = await aggregationService.getTeamOverview()
  res.json({ code: 0, data: result })
}

export async function getHeatmap(req: Request, res: Response) {
  const result = await aggregationService.getPracticeHeatmap()
  res.json({ code: 0, data: result })
}

export async function getRanking(req: Request, res: Response) {
  const result = await aggregationService.getTeamRanking()
  res.json({ code: 0, data: result })
}

export async function getReport(req: Request, res: Response) {
  const startDate = req.query.startDate as string
  const endDate = req.query.endDate as string
  const result = await aggregationService.generateTeamReport(startDate, endDate)
  res.json({ code: 0, data: result })
}

export async function exportReport(req: Request, res: Response) {
  const startDate = req.query.startDate as string
  const endDate = req.query.endDate as string
  const format = (req.query.format as string) || 'json'
  const result = await aggregationService.exportTeamReport(startDate, endDate, format)

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv')
    return res.send(result)
  }

  res.json({ code: 0, data: result })
}

export async function getComparison(req: Request, res: Response) {
  const teacherIds = (req.query.ids as string || '').split(',').map(Number).filter(Boolean)
  const result = await aggregationService.compareTeachers(teacherIds)
  res.json({ code: 0, data: result })
}

export async function getCommonIssues(req: Request, res: Response) {
  const startDate = req.query.startDate as string
  const endDate = req.query.endDate as string
  const result = await aggregationService.analyzeCommonIssues(startDate, endDate)
  res.json({ code: 0, data: result })
}