import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { requireRole } from '../middlewares/requireRole'
import { createScenario, listScenarios, getScenario, updateScenario, deleteScenario, updateStatus } from '../controllers/scenario.controller'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)
router.post('/', requireRole('TRAINER'), asyncHandler(createScenario))
router.get('/', asyncHandler(listScenarios))
router.get('/:id', asyncHandler(getScenario))
router.put('/:id', requireRole('TRAINER'), asyncHandler(updateScenario))
router.delete('/:id', requireRole('TRAINER'), asyncHandler(deleteScenario))
router.patch('/:id/status', requireRole('TRAINER'), asyncHandler(updateStatus))

export default router