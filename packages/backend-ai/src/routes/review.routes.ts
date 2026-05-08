import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { generateReview, getReview, submitFeedback } from '../controllers/review.controller'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)

router.post('/generate', asyncHandler(generateReview))
router.get('/:conversationId', asyncHandler(getReview))
router.put('/:reviewId/feedback', asyncHandler(submitFeedback))

export default router
