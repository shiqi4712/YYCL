import { Router } from 'express'
import fs from 'node:fs'
import multer from 'multer'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import type { AuthedRequest } from '../types'
import {
  createSession,
  endSession,
  generateReview,
  generateParentReply,
  getSessionDetail,
  listTeacherSessions,
  sendTeacherMessage,
} from '../services/training.service'
import { ok } from '../utils/api'
import {
  assertTrainingImageUploadAllowed,
  createTrainingImageFileName,
  deletePendingTrainingImage,
  saveTrainingImage,
  trainingImageMimeTypes,
  trainingImageUploadDir,
} from '../services/training-image.service'
import { HttpError } from '../utils/http-error'

const router = Router()

const createSessionSchema = z.object({
  scenarioId: z.string().min(1),
})

const messageSchema = z.object({
  content: z.string().max(2000).default(''),
  imageIds: z.array(z.string().min(1)).default([]),
}).refine((input) => input.content.trim() || input.imageIds.length > 0, {
  message: '请输入回复或添加图片',
})

const trainingImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdirSync(trainingImageUploadDir, { recursive: true })
      callback(null, trainingImageUploadDir)
    },
    filename: (_req, file, callback) => {
      callback(null, createTrainingImageFileName(file.mimetype))
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!trainingImageMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, '请上传 PNG、JPG、WEBP 或 GIF 图片'))
      return
    }
    callback(null, true)
  },
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

router.post(
  '/sessions/:sessionId/images',
  async (req: AuthedRequest, _res, next) => {
    try {
      await assertTrainingImageUploadAllowed(req.params.sessionId, req.user!.id)
      next()
    } catch (error) {
      next(error)
    }
  },
  trainingImageUpload.single('image'),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, '请选择需要上传的图片')
      }
      res.json(ok(await saveTrainingImage(req.params.sessionId, req.user!.id, req.file)))
    } catch (error) {
      next(error)
    }
  }
)

router.delete('/sessions/:sessionId/images/:imageId', async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await deletePendingTrainingImage(req.params.imageId, req.params.sessionId, req.user!.id)))
  } catch (error) {
    next(error)
  }
})

router.post('/sessions/:sessionId/messages', async (req: AuthedRequest, res, next) => {
  try {
    const payload = messageSchema.parse(req.body)
    res.json(ok(await sendTeacherMessage(req.params.sessionId, req.user!.id, payload)))
  } catch (error) {
    next(error)
  }
})

router.post('/sessions/:sessionId/reply', async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await generateParentReply(req.params.sessionId, req.user!.id)))
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
