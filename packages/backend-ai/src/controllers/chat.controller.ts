import type { Request, Response } from 'express'
import * as conversationService from '../services/conversation.service'

export async function createSession(req: Request, res: Response) {
  const { scenarioId } = req.body
  const teacherId = (req as any).user.id
  const result = await conversationService.createSession(scenarioId, teacherId)
  res.json({ code: 0, data: result })
}

export async function sendMessage(req: Request, res: Response) {
  const sessionId = Number(req.params.sessionId)
  const { content } = req.body
  const result = await conversationService.sendMessage(sessionId, content)
  res.json({ code: 0, data: result })
}

export async function getConversation(req: Request, res: Response) {
  const sessionId = Number(req.params.sessionId)
  const result = await conversationService.getConversation(sessionId)
  res.json({ code: 0, data: result })
}

export async function endConversation(req: Request, res: Response) {
  const sessionId = Number(req.params.sessionId)
  const result = await conversationService.endConversation(sessionId)
  res.json({ code: 0, data: result })
}
