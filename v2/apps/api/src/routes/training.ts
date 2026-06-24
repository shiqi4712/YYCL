import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import type { AuthedRequest } from '../types'
import {
  createSession,
  endSession,
  generateReview,
  getSessionDetail,
  listTeacherSessions,
  sendTeacherMessage,
} from '../services/training.service'
import { ok } from '../utils/api'

const router = Router()

const createSessionSchema = z.object({
  scenarioId: z.string().min(1),
})

const messageSchema = z.object({
  content: z.string().min(1).max(2000),
})

router.use(authenticate)

router.post('/sessions', async (req: AuthedRequest, res, next) => {
  try {
    const payload = createSessionSchema.parse(req.body)
    res.json(ok(await createSession(req.user!.id, payload.scenarioId)))
  } catch (error) {
    next(error)
  }
})

router.get('/sessions', async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await listTeacherSessions(req.user!.id)))
  } catch (error) {
    next(error)
  }
})

router.get('/sessions/:sessionId', async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await getSessionDetail(req.params.sessionId, req.user!.id)))
  } catch (error) {
    next(error)
  }
})

router.post('/sessions/:sessionId/messages', async (req: AuthedRequest, res, next) => {
  try {
    const payload = messageSchema.parse(req.body)
    res.json(ok(await sendTeacherMessage(req.params.sessionId, req.user!.id, payload.content)))
  } catch (error) {
    next(error)
  }
})

router.post('/sessions/:sessionId/end', async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await endSession(req.params.sessionId, req.user!.id)))
  } catch (error) {
    next(error)
  }
})

router.post('/sessions/:sessionId/review', async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await generateReview(req.params.sessionId, req.user!.id)))
  } catch (error) {
    next(error)
  }
})

export default router
