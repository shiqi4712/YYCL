import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import type { AuthedRequest } from '../types'
import { login } from '../services/auth.service'
import { getCurrentUserProfile } from '../services/admin.service'
import { ok } from '../utils/api'

const router = Router()

router.post('/login', async (req, res, next) => {
  try {
    res.json(ok(await login(req.body)))
  } catch (error) {
    next(error)
  }
})

router.get('/me', authenticate, async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await getCurrentUserProfile(req.user!.id)))
  } catch (error) {
    next(error)
  }
})

export default router
