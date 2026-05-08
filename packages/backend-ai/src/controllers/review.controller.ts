import type { Request, Response } from 'express'
import * as conversationService from '../services/conversation.service'
import { prisma } from '../middlewares/prisma'

export async function generateReview(req: Request, res: Response) {
  const conversationId = Number(req.params.conversationId)
  const result = await conversationService.generateReview(conversationId)
  res.json({ code: 0, data: result })
}

export async function getReview(req: Request, res: Response) {
  const conversationId = Number(req.params.conversationId)

  // Try to return persisted review first
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { aiReview: true, finalScore: true },
  })

  if (conv?.aiReview) {
    try {
      const review = JSON.parse(conv.aiReview)
      return res.json({ code: 0, data: review })
    } catch {
      // fallback to regeneration
    }
  }

  const result = await conversationService.generateReview(conversationId)
  res.json({ code: 0, data: result })
}

export async function submitFeedback(req: Request, res: Response) {
  const { feedback } = req.body
  // Log feedback for future prompt optimization
  console.log('Review feedback:', req.params.reviewId, feedback)
  res.json({ code: 0, data: null })
}
