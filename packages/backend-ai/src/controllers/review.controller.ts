import type { Request, Response } from 'express'
import * as conversationService from '../services/conversation.service'

export async function generateReview(req: Request, res: Response) {
  const conversationId = Number(req.params.conversationId)
  const result = await conversationService.generateReview(conversationId)
  res.json({ code: 0, data: result })
}

export async function getReview(req: Request, res: Response) {
  // In MVP, review is generated on-the-fly or cached in memory
  // For now, regenerate or return placeholder
  const conversationId = Number(req.params.conversationId)
  const result = await conversationService.generateReview(conversationId)
  res.json({ code: 0, data: result })
}

export async function submitFeedback(req: Request, res: Response) {
  const { feedback } = req.body
  // Log feedback for future prompt optimization
  console.log('Review feedback:', req.params.reviewId, feedback)
  res.json({ code: 0, data: null })
}
