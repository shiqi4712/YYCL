import { Router } from 'express'
import { getTeamOverview, getHeatmap, getRanking, getReport, exportReport, getComparison, getCommonIssues } from '../controllers/team-report.controller'

const router = Router()

router.get('/overview', getTeamOverview)
router.get('/heatmap', getHeatmap)
router.get('/ranking', getRanking)
router.get('/report', getReport)
router.get('/export', exportReport)
router.get('/comparison', getComparison)
router.get('/common-issues', getCommonIssues)

export default router