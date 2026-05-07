import type { Request, Response } from 'express'
import * as scriptService from '../services/script.service'

export async function createScript(req: Request, res: Response) {
  const userId = (req as any).user.id
  const result = await scriptService.createScript(req.body, userId)
  res.json({ code: 0, data: result })
}

export async function listScripts(req: Request, res: Response) {
  const result = await scriptService.listScripts(req.query as any)
  res.json({ code: 0, data: result })
}

export async function updateScript(req: Request, res: Response) {
  const result = await scriptService.updateScript(Number(req.params.id), req.body)
  res.json({ code: 0, data: result })
}

export async function deleteScript(req: Request, res: Response) {
  await scriptService.deleteScript(Number(req.params.id))
  res.json({ code: 0, data: null })
}

export async function updateStatus(req: Request, res: Response) {
  const result = await scriptService.updateStatus(Number(req.params.id), req.body.status)
  res.json({ code: 0, data: result })
}

export async function favorite(req: Request, res: Response) {
  const teacherId = (req as any).user.id
  await scriptService.favorite(Number(req.params.id), teacherId)
  res.json({ code: 0, data: null })
}

export async function unfavorite(req: Request, res: Response) {
  const teacherId = (req as any).user.id
  await scriptService.unfavorite(Number(req.params.id), teacherId)
  res.json({ code: 0, data: null })
}

export async function listFavorites(req: Request, res: Response) {
  const teacherId = (req as any).user.id
  const result = await scriptService.listFavorites(teacherId)
  res.json({ code: 0, data: result })
}