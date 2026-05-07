import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { requireRole } from '../middlewares/requireRole'
import { createScript, listScripts, updateScript, deleteScript, updateStatus, favorite, unfavorite, listFavorites } from '../controllers/script.controller'

const router = Router()

router.use(authenticate)
router.post('/', requireRole('TRAINER'), createScript)
router.get('/', listScripts)
router.get('/favorites', listFavorites)
router.put('/:id', requireRole('TRAINER'), updateScript)
router.delete('/:id', requireRole('TRAINER'), deleteScript)
router.patch('/:id/status', requireRole('TRAINER'), updateStatus)
router.post('/:id/favorite', favorite)
router.delete('/:id/favorite', unfavorite)

export default router