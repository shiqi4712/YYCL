import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { requireRole } from '../middlewares/requireRole'
import { createScript, listScripts, updateScript, deleteScript, updateStatus, favorite, unfavorite, listFavorites } from '../controllers/script.controller'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)
router.post('/', requireRole('TRAINER'), asyncHandler(createScript))
router.get('/', asyncHandler(listScripts))
router.get('/favorites', asyncHandler(listFavorites))
router.put('/:id', requireRole('TRAINER'), asyncHandler(updateScript))
router.delete('/:id', requireRole('TRAINER'), asyncHandler(deleteScript))
router.patch('/:id/status', requireRole('TRAINER'), asyncHandler(updateStatus))
router.post('/:id/favorite', asyncHandler(favorite))
router.delete('/:id/favorite', asyncHandler(unfavorite))

export default router