import { Router } from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { TextDecoder } from 'node:util'
import multer from 'multer'
import * as XLSX from 'xlsx'
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
  deleteUser,
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

function parseUserCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if ((char === ',' || char === '，' || char === '\t' || char === ';' || char === '；') && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  if (cells.length === 1 && /\s+/.test(cells[0])) {
    return cells[0].split(/\s+/).map((cell) => cell.trim()).filter(Boolean)
  }
  return cells
}

function parseTeacherUsersRows(rows: string[][]) {
  const normalizedRows = rows
    .map((row) => row.map((cell) => String(cell || '').trim()))
    .filter((row) => row.some(Boolean))
    .filter((row) => !/^sep\s*=/i.test(row[0] || ''))

  if (normalizedRows.length < 2) {
    throw new HttpError(400, '请上传包含表头和账号数据的表格')
  }

  const headers = normalizedRows[0].map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase())
  let usernameIndex = headers.findIndex((header) => ['工号', '账号', '登录账号', 'username'].includes(header))
  let displayNameIndex = headers.findIndex((header) => ['姓名', '老师姓名', 'displayname', 'name'].includes(header))
  let passwordIndex = headers.findIndex((header) => ['密码', '初始密码', 'password'].includes(header))

  if (usernameIndex < 0 || displayNameIndex < 0 || passwordIndex < 0) {
    if (headers.length >= 3) {
      usernameIndex = 0
      displayNameIndex = 1
      passwordIndex = 2
    } else {
      throw new HttpError(400, '表头必须包含：工号,姓名,密码')
    }
  }

  return normalizedRows.slice(1).map((row, index) => {
    const username = (row[usernameIndex] || '').trim()
    const displayName = (row[displayNameIndex] || '').trim()
    const password = (row[passwordIndex] || '').trim()

    if (!username || !displayName || !password) {
      throw new HttpError(400, `第 ${index + 2} 行缺少工号、姓名或密码`)
    }

    return { username, displayName, password }
  })
}

function parseTeacherUsersCsv(text: string) {
  const rows = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^sep\s*=/i.test(line))
    .map(parseUserCsvLine)

  return parseTeacherUsersRows(rows)
}

function decodeCsvBuffer(buffer: Buffer) {
  const texts = [buffer.toString('utf8')]
  for (const encoding of ['gb18030', 'gbk']) {
    try {
      texts.push(new TextDecoder(encoding).decode(buffer))
    } catch {
      // Some Node builds may not expose every legacy label; UTF-8 fallback remains available.
    }
  }
  return Array.from(new Set(texts))
}

function parseTeacherUsersCsvBuffer(buffer: Buffer) {
  let lastError: unknown
  for (const text of decodeCsvBuffer(buffer)) {
    try {
      return parseTeacherUsersCsv(text)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

function parseTeacherUsersXlsxBuffer(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new HttpError(400, 'Excel 表格为空，请检查文件内容')
  }

  const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: '',
    blankrows: false,
  })

  return parseTeacherUsersRows(rows.map((row) => row.map((cell) => String(cell || '').trim())))
}

function parseTeacherUsersFile(file: Express.Multer.File) {
  const ext = path.extname(file.originalname || '').toLowerCase()
  if (ext === '.xlsx' || ext === '.xls') {
    return parseTeacherUsersXlsxBuffer(file.buffer)
  }

  return parseTeacherUsersCsvBuffer(file.buffer)
}

function normalizeDifficulty(value: string) {
  const text = value.trim().toUpperCase()
  if (['BASIC', '基础', '简单'].includes(text)) return 'BASIC'
  if (['ADVANCED', '进阶', '高级', '困难'].includes(text)) return 'ADVANCED'
  return 'STANDARD'
}

function normalizeTrainingStatus(value: string) {
  const text = value.trim().toUpperCase()
  if (['INACTIVE', '下架', '停用'].includes(text)) return 'INACTIVE'
  return 'ACTIVE'
}

function pickTrainingColumn(headers: string[], aliases: string[], fallbackIndex: number) {
  const index = headers.findIndex((header) => aliases.includes(header))
  return index >= 0 ? index : fallbackIndex
}

function parseTrainingScenarioRows(rows: string[][]) {
  const normalizedRows = rows
    .map((row) => row.map((cell) => String(cell || '').trim()))
    .filter((row) => row.some(Boolean))
    .filter((row) => !/^sep\s*=/i.test(row[0] || ''))

  if (normalizedRows.length < 2) {
    throw new HttpError(400, '请上传包含表头和训练数据的表格')
  }

  const headers = normalizedRows[0].map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase())
  const titleIndex = pickTrainingColumn(headers, ['场景标题', '训练场景', '场景', 'title'], 0)
  const descriptionIndex = pickTrainingColumn(headers, ['场景说明', '场景描述', 'description'], 1)
  const parentPersonaIndex = pickTrainingColumn(headers, ['家长情况', '学生情况', '家长学生情况', 'parentpersona'], 2)
  const openingLineIndex = pickTrainingColumn(headers, ['开场话术', '家长开场', 'openingline'], 3)
  const difficultyIndex = pickTrainingColumn(headers, ['难度', 'difficulty'], 4)
  const stepOrderIndex = pickTrainingColumn(headers, ['异议顺序', '顺序', 'order'], 5)
  const stepTitleIndex = pickTrainingColumn(headers, ['异议标题', '步骤标题', 'steptitle'], 6)
  const objectionTextIndex = pickTrainingColumn(headers, ['异议内容', '家长异议', 'objectiontext'], 7)
  const evaluationFocusIndex = pickTrainingColumn(headers, ['评估重点', '点评关注点', 'evaluationfocus'], 8)
  const statusIndex = pickTrainingColumn(headers, ['状态', 'status'], 9)

  const grouped = new Map<
    string,
    {
      title: string
      description: string
      parentPersona: string
      openingLine: string
      difficulty: 'BASIC' | 'STANDARD' | 'ADVANCED'
      status: 'ACTIVE' | 'INACTIVE'
      steps: Array<{
        order: number
        title: string
        objectionText: string
        evaluationFocus: string
      }>
    }
  >()

  normalizedRows.slice(1).forEach((row, index) => {
    const title = (row[titleIndex] || '').trim()
    const objectionText = (row[objectionTextIndex] || '').trim()

    if (!title || !objectionText) {
      throw new HttpError(400, `第 ${index + 2} 行缺少场景标题或异议内容`)
    }

    const item =
      grouped.get(title) ||
      {
        title,
        description: (row[descriptionIndex] || title).trim(),
        parentPersona: (row[parentPersonaIndex] || '家长对课程仍有顾虑，需要老师进一步沟通。').trim(),
        openingLine: (row[openingLineIndex] || `家长：我想再了解一下，${objectionText}`).trim(),
        difficulty: normalizeDifficulty(row[difficultyIndex] || '') as 'BASIC' | 'STANDARD' | 'ADVANCED',
        status: normalizeTrainingStatus(row[statusIndex] || '') as 'ACTIVE' | 'INACTIVE',
        steps: [],
      }

    item.steps.push({
      order: Number(row[stepOrderIndex]) || item.steps.length + 1,
      title: (row[stepTitleIndex] || `异议 ${item.steps.length + 1}`).trim(),
      objectionText,
      evaluationFocus: (row[evaluationFocusIndex] || '判断老师是否共情、建立标准、赋能、给案例并完成缔结。').trim(),
    })
    grouped.set(title, item)
  })

  return Array.from(grouped.values()).map((scenario) => ({
    ...scenario,
    steps: scenario.steps.sort((a, b) => a.order - b.order).map((step, index) => ({
      ...step,
      order: index + 1,
    })),
  }))
}

function parseTrainingScenariosFile(file: Express.Multer.File) {
  const ext = path.extname(file.originalname || '').toLowerCase()
  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new HttpError(400, 'Excel 表格为空，请检查文件内容')
    }
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(workbook.Sheets[firstSheetName], {
      header: 1,
      defval: '',
      blankrows: false,
    })
    return parseTrainingScenarioRows(rows.map((row) => row.map((cell) => String(cell || '').trim())))
  }

  let lastError: unknown
  for (const text of decodeCsvBuffer(file.buffer)) {
    try {
      const rows = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseUserCsvLine)
      return parseTrainingScenarioRows(rows)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

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

router.post('/users/import/document', requireRole('TRAINER'), upload.single('usersFile'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, '请上传老师账号 CSV 表格')
    }

    const users = parseTeacherUsersFile(req.file)
    res.json(ok(await importTeacherUsers({ users })))
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

router.delete('/users/:userId', requireRole('TRAINER'), async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await deleteUser(req.params.userId, req.user!.id)))
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

router.post('/scenarios/import/document', requireRole('TRAINER'), upload.single('document'), async (req: AuthedRequest, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError(400, '请上传训练场景导入表格')
    }

    const scenarios = parseTrainingScenariosFile(req.file)
    const topicId = typeof req.body.topicId === 'string' ? req.body.topicId.trim() : ''
    const topicTitle = typeof req.body.topicTitle === 'string' ? req.body.topicTitle.trim() : ''
    const topicDescription =
      typeof req.body.topicDescription === 'string'
        ? req.body.topicDescription.trim()
        : ''

    const topic = topicId
      ? { id: topicId }
      : await createTopic(req.user!.id, {
          trainingModule: 'PRE_CLASS',
          title: topicTitle || '异议处理训练',
          description: topicDescription || '通过导入文件创建的异议处理训练主题。',
          status: 'ACTIVE',
        })

    res.json(ok(await importScenarios(req.user!.id, { topicId: topic.id, scenarios })))
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
