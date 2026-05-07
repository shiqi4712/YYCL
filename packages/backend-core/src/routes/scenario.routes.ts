import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { requireRole } from '../middlewares/requireRole'
import { createScenario, listScenarios, getScenario, updateScenario, deleteScenario, updateStatus } from '../controllers/scenario.controller'

const router = Router()

router.use(authenticate)
router.post('/', requireRole('TRAINER'), createScenario)
router.get('/', listScenarios)
router.get('/:id', getScenario)
router.put('/:id', requireRole('TRAINER'), updateScenario)
router.delete('/:id', requireRole('TRAINER'), deleteScenario)
router.patch('/:id/status', requireRole('TRAINER'), updateStatus)

export default router