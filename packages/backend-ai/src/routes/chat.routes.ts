import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { createSession, sendMessage, getConversation, endConversation } from '../controllers/chat.controller'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)

router.post('/sessions', asyncHandler(createSession))
router.post('/:sessionId/message', asyncHandler(sendMessage))
router.get('/:sessionId', asyncHandler(getConversation))
router.post('/:sessionId/end', asyncHandler(endConversation))

export default router
