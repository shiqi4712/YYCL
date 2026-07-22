import { Router } from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { z } from 'zod'
import { extractSopTextFromFile, extractTextFromFile } from '../lib/document-parser'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/require-role'
import type { AuthedRequest } from '../types'
import { HttpError } from '../utils/http-error'
import {
  createScenario,
  createTopic,
  createUser,
  deleteScenario,
  deleteScenarios,
  deleteTopic,
  getCurrentUserProfile,
  getDashboardSummary,
  importTeacherUsers,
  importScenarios,
  listTopicsForAdmin,
  listUsers,
  updateScenario,
  updateTopic,
  updateTopicSop,
  updateUserStatus,
} from '../services/admin.service'
import { ok } from '../utils/api'
import {
  createObjection,
  importObjections,
  listObjectionsForAdmin,
  parseObjectionImportText,
  updateObjection,
  updateObjectionStatus,
} from '../services/objection.service'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})
const materialUploadDir = path.resolve(__dirname, '../../uploads/materials')
const imageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const materialUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdirSync(materialUploadDir, { recursive: true })
      callback(null, materialUploadDir)
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase()
      callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`)
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!imageMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, '请上传 PNG、JPG、WEBP 或 GIF 图片'))
      return
    }
    callback(null, true)
  },
})

const statusSchema = z.object({
  isActive: z.boolean(),
})

const objectionStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
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

router.get('/objections', requireRole('TRAINER'), async (req, res, next) => {
  try {
    const scene = typeof req.query.scene === 'string' ? req.query.scene : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : undefined
    res.json(ok(await listObjectionsForAdmin(scene, status, keyword)))
  } catch (error) {
    next(error)
  }
})

router.post('/objections', requireRole('TRAINER'), async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await createObjection(req.user!.id, req.body)))
  } catch (error) {
    next(error)
  }
})

router.put('/objections/:objectionId', requireRole('TRAINER'), async (req, res, next) => {
  try {
    res.json(ok(await updateObjection(req.params.objectionId, req.body)))
  } catch (error) {
    next(error)
  }
})

router.patch('/objections/:objectionId/status', requireRole('TRAINER'), async (req, res, next) => {
  try {
    const payload = objectionStatusSchema.parse(req.body)
    res.json(ok(await updateObjectionStatus(req.params.objectionId, payload.status)))
  } catch (error) {
    next(error)
  }
})

router.post('/objections/import', requireRole('TRAINER'), async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await importObjections(req.user!.id, req.body)))
  } catch (error) {
    next(error)
  }
})

router.post(
  '/materials/upload',
  requireRole('TRAINER'),
  materialUpload.single('image'),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, '请上传图片物料')
      }

      res.json(
        ok({
          type: 'IMAGE',
          title: req.body.title || path.parse(req.file.originalname).name || '图片物料',
          url: `/uploads/materials/${req.file.filename}`,
          description: req.body.description || '',
        })
      )
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  '/objections/import/document',
  requireRole('TRAINER'),
  upload.single('document'),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, '请上传异议导入文档')
      }

      const defaultScene = typeof req.body.defaultScene === 'string' ? req.body.defaultScene : 'pre'
      const text = await extractTextFromFile(req.file, '异议')
      const items = parseObjectionImportText(text, defaultScene)
      res.json(ok(await importObjections(req.user!.id, { defaultScene, items })))
    } catch (error) {
      next(error)
    }
  }
)

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

router.put('/topics/:topicId/sop', requireRole('TRAINER'), async (req, res, next) => {
  try {
    res.json(ok(await updateTopicSop(req.params.topicId, req.body)))
  } catch (error) {
    next(error)
  }
})

router.post('/topics/:topicId/sop/import', requireRole('TRAINER'), upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, '请上传 SOP 文档')
    }

    const sopContent = await extractSopTextFromFile(req.file)
    res.json(ok(await updateTopicSop(req.params.topicId, { sopContent })))
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

router.post('/scenarios/import', requireRole('TRAINER'), async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await importScenarios(req.user!.id, req.body)))
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

router.post('/scenarios/delete', requireRole('TRAINER'), async (req, res, next) => {
  try {
    res.json(ok(await deleteScenarios(req.body)))
  } catch (error) {
    next(error)
  }
})

export default router
