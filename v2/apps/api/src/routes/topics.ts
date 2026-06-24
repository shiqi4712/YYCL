import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { listTopics } from '../services/topic.service'
import { ok } from '../utils/api'

const router = Router()

router.use(authenticate)

router.get('/', async (_req, res, next) => {
  try {
    res.json(ok(await listTopics()))
  } catch (error) {
    next(error)
  }
})

export default router
