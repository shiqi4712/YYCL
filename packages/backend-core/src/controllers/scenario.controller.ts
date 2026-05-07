import type { Request, Response } from 'express'
import * as scenarioService from '../services/scenario.service'

export async function createScenario(req: Request, res: Response) {
  const userId = (req as any).user.id
  const result = await scenarioService.createScenario(req.body, userId)
  res.json({ code: 0, data: result })
}

export async function listScenarios(req: Request, res: Response) {
  const result = await scenarioService.listScenarios(req.query as any)
  res.json({ code: 0, data: result })
}

export async function getScenario(req: Request, res: Response) {
  const result = await scenarioService.getScenario(Number(req.params.id))
  res.json({ code: 0, data: result })
}

export async function updateScenario(req: Request, res: Response) {
  const result = await scenarioService.updateScenario(Number(req.params.id), req.body)
  res.json({ code: 0, data: result })
}

export async function deleteScenario(req: Request, res: Response) {
  await scenarioService.deleteScenario(Number(req.params.id))
  res.json({ code: 0, data: null })
}

export async function updateStatus(req: Request, res: Response) {
  const result = await scenarioService.updateStatus(Number(req.params.id), req.body.status)
  res.json({ code: 0, data: result })
}