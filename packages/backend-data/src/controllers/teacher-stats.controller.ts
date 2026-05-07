import type { Request, Response } from 'express'
import * as aggregationService from '../services/aggregation.service'

export async function getOverview(req: Request, res: Response) {
  const teacherId = Number(req.query.teacherId) || 0
  const result = await aggregationService.getTeacherOverview(teacherId)
  res.json({ code: 0, data: result })
}

export async function getTrend(req: Request, res: Response) {
  const teacherId = Number(req.query.teacherId) || 0
  const result = await aggregationService.getTeacherTrend(teacherId)
  res.json({ code: 0, data: result })
}

export async function getRadar(req: Request, res: Response) {
  const teacherId = Number(req.query.teacherId) || 0
  const result = await aggregationService.getTeacherRadar(teacherId)
  res.json({ code: 0, data: result })
}

export async function getHistory(req: Request, res: Response) {
  const teacherId = Number(req.query.teacherId) || 0
  const page = Number(req.query.page) || 1
  const pageSize = Number(req.query.pageSize) || 10
  const result = await aggregationService.getTeacherHistory(teacherId, page, pageSize)
  res.json({ code: 0, data: result })
}