import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { prisma } from '../middlewares/prisma'

const router = Router()

router.use(authenticate)

// Create conversation (called by AI service or frontend)
router.post('/sessions', async (req, res) => {
  const { scenarioId, initialMessage } = req.body
  const teacherId = (req as any).user.id
  const conv = await prisma.conversation.create({
    data: {
      teacherId,
      scenarioId,
      status: 'ACTIVE'
    }
  })
  await prisma.message.create({
    data: {
      conversationId: conv.id,
      role: 'AI',
      content: initialMessage,
      messageType: 'TEXT'
    }
  })
  res.json({ code: 0, data: { id: conv.id, initialMessage } })
})

// Get conversation with messages
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      scenario: { select: { id: true, title: true } }
    }
  })
  if (!conv) return res.status(404).json({ code: 404, message: '对话不存在' })
  res.json({ code: 0, data: conv })
})

// Save message
router.post('/:id/message', async (req, res) => {
  const conversationId = Number(req.params.id)
  const { role, content } = req.body
  const msg = await prisma.message.create({
    data: { conversationId, role, content, messageType: 'TEXT' }
  })
  res.json({ code: 0, data: msg })
})

// End conversation
router.post('/:id/end', async (req, res) => {
  const id = Number(req.params.id)
  const { finalScore, aiReview } = req.body
  const conv = await prisma.conversation.update({
    where: { id },
    data: {
      status: req.body.status || 'COMPLETED',
      finalScore,
      aiReview: aiReview ? JSON.stringify(aiReview) : undefined,
      endedAt: new Date()
    }
  })
  res.json({ code: 0, data: conv })
})

export default router