import { Router } from 'express'
import { getOverview, getTrend, getRadar, getHistory } from '../controllers/teacher-stats.controller'

const router = Router()

router.get('/overview', getOverview)
router.get('/trend', getTrend)
router.get('/radar', getRadar)
router.get('/history', getHistory)

export default router