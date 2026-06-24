import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/require-role'
import type { AuthedRequest } from '../types'
import {
  createScenario,
  createTopic,
  createUser,
  deleteScenario,
  deleteTopic,
  getCurrentUserProfile,
  getDashboardSummary,
  importTeacherUsers,
  listTopicsForAdmin,
  listUsers,
  updateScenario,
  updateTopic,
  updateUserStatus,
} from '../services/admin.service'
import { ok } from '../utils/api'

const router = Router()

const statusSchema = z.object({
  isActive: z.boolean(),
})

router.use(authenticate)

router.get('/me', async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await getCurrentUserProfile(req.user!.id)))
  } catch (error) {
    next(error)
  }
})

router.get('/dashboard', requireRole('TRAINER'), async (_req, res, next) => {
  try {
    res.json(ok(await getDashboardSummary()))
  } catch (error) {
    next(error)
  }
})

router.get('/users', requireRole('TRAINER'), async (req, res, next) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined
    res.json(ok(await listUsers(role)))
  } catch (error) {
    next(error)
  }
})

router.post('/users', requireRole('TRAINER'), async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await createUser(req.body)))
  } catch (error) {
    next(error)
  }
})

router.post('/users/import', requireRole('TRAINER'), async (req, res, next) => {
  try {
    res.json(ok(await importTeacherUsers(req.body)))
  } catch (error) {
    next(error)
  }
})

router.patch('/users/:userId/status', requireRole('TRAINER'), async (req, res, next) => {
  try {
    const payload = statusSchema.parse(req.body)
    res.json(ok(await updateUserStatus(req.params.userId, payload.isActive)))
  } catch (error) {
    next(error)
  }
})

router.get('/topics', requireRole('TRAINER'), async (_req, res, next) => {
  try {
    res.json(ok(await listTopicsForAdmin()))
  } catch (error) {
    next(error)
  }
})

router.post('/topics', requireRole('TRAINER'), async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await createTopic(req.user!.id, req.body)))
  } catch (error) {
    next(error)
  }
})

router.put('/topics/:topicId', requireRole('TRAINER'), async (req, res, next) => {
  try {
    res.json(ok(await updateTopic(req.params.topicId, req.body)))
  } catch (error) {
    next(error)
  }
})

router.delete('/topics/:topicId', requireRole('TRAINER'), async (req, res, next) => {
  try {
    res.json(ok(await deleteTopic(req.params.topicId)))
  } catch (error) {
    next(error)
  }
})

router.post('/scenarios', requireRole('TRAINER'), async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await createScenario(req.user!.id, req.body)))
  } catch (error) {
    next(error)
  }
})

router.put('/scenarios/:scenarioId', requireRole('TRAINER'), async (req, res, next) => {
  try {
    res.json(ok(await updateScenario(req.params.scenarioId, req.body)))
  } catch (error) {
    next(error)
  }
})

router.delete('/scenarios/:scenarioId', requireRole('TRAINER'), async (req, res, next) => {
  try {
    res.json(ok(await deleteScenario(req.params.scenarioId)))
  } catch (error) {
    next(error)
  }
})

export default router
