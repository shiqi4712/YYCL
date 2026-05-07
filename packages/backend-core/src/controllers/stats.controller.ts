import type { Request, Response } from 'express'
import * as statsService from '../services/stats.service'

export async function getTeacherHistory(req: Request, res: Response) {
  const teacherId = (req as any).user.id
  const page = Number(req.query.page) || 1
  const pageSize = Number(req.query.pageSize) || 10
  const result = await statsService.getTeacherHistory(teacherId, page, pageSize)
  res.json({ code: 0, data: result })
}

export async function getTeacherOverview(req: Request, res: Response) {
  const teacherId = (req as any).user.id
  const result = await statsService.getTeacherOverview(teacherId)
  res.json({ code: 0, data: result })
}

export async function getTeacherTrend(req: Request, res: Response) {
  const teacherId = (req as any).user.id
  const result = await statsService.getTeacherTrend(teacherId)
  res.json({ code: 0, data: result })
}

export async function getTeacherRadar(req: Request, res: Response) {
  const teacherId = (req as any).user.id
  const result = await statsService.getTeacherRadar(teacherId)
  res.json({ code: 0, data: result })
}

export async function getTeamOverview(req: Request, res: Response) {
  const result = await statsService.getTeamOverview()
  res.json({ code: 0, data: result })
}