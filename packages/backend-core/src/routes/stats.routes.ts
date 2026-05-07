import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { requireRole } from '../middlewares/requireRole'
import { getTeacherHistory, getTeacherOverview, getTeacherTrend, getTeacherRadar, getTeamOverview } from '../controllers/stats.controller'

const router = Router()

router.use(authenticate)

// Teacher personal stats
router.get('/teacher/history', getTeacherHistory)
router.get('/teacher/overview', getTeacherOverview)
router.get('/teacher/trend', getTeacherTrend)
router.get('/teacher/radar', getTeacherRadar)

// Team stats (trainer only)
router.get('/team/overview', requireRole('TRAINER'), getTeamOverview)

export default router