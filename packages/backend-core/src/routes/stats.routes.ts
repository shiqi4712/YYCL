import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { requireRole } from '../middlewares/requireRole'
import { getTeacherHistory, getTeacherOverview, getTeacherTrend, getTeacherRadar, getTeamOverview } from '../controllers/stats.controller'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)

// Teacher personal stats
router.get('/teacher/history', asyncHandler(getTeacherHistory))
router.get('/teacher/overview', asyncHandler(getTeacherOverview))
router.get('/teacher/trend', asyncHandler(getTeacherTrend))
router.get('/teacher/radar', asyncHandler(getTeacherRadar))

// Team stats (trainer only)
router.get('/team/overview', requireRole('TRAINER'), asyncHandler(getTeamOverview))

export default router