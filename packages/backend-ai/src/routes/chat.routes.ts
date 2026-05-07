import { Router } from 'express'
import { createSession, sendMessage, getConversation, endConversation } from '../controllers/chat.controller'

const router = Router()

router.post('/sessions', createSession)
router.post('/:sessionId/message', sendMessage)
router.get('/:sessionId', getConversation)
router.post('/:sessionId/end', endConversation)

export default router
