import { Router } from 'express'
import { generateReview, getReview, submitFeedback } from '../controllers/review.controller'

const router = Router()

router.post('/generate', generateReview)
router.get('/:conversationId', getReview)
router.put('/:reviewId/feedback', submitFeedback)

export default router
