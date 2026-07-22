import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { listObjectionsForTeacher } from '../services/objection.service'
import { ok } from '../utils/api'

const router = Router()

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const scene = typeof req.query.scene === 'string' ? req.query.scene : undefined
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : undefined
    res.json(ok(await listObjectionsForTeacher(scene, keyword)))
  } catch (error) {
    next(error)
  }
})

export default router
