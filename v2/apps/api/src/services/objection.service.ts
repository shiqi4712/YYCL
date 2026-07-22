import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

const sceneSchema = z.enum(['pre', 'mid', 'close'])
const statusSchema = z.enum(['ACTIVE', 'INACTIVE'])

const objectionSchema = z.object({
  scene: sceneSchema,
  title: z.string().min(1).max(120),
  concern: z.string().min(1).max(1000),
  keywords: z.array(z.string().min(1).max(30)).max(20).default([]),
  thinking: z.array(z.string().min(1).max(500)).min(1).max(12),
  scripts: z.array(z.string().min(1).max(2000)).min(1).max(12),
  avoid: z.string().min(1).max(1000),
  status: statusSchema.default('ACTIVE'),
})

const importSchema = z.object({
  defaultScene: sceneSchema.default('pre'),
  items: z.array(objectionSchema.partial({ scene: true, status: true })).min(1).max(200),
})

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapObjection(item: {
  id: string
  scene: string
  title: string
  concern: string
  keywordsJson: string
  thinkingJson: string
  scriptsJson: string
  avoid: string
  status: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: item.id,
    scene: item.scene,
    title: item.title,
    concern: item.concern,
    keywords: parseJsonArray(item.keywordsJson),
    thinking: parseJsonArray(item.thinkingJson),
    scripts: parseJsonArray(item.scriptsJson),
    avoid: item.avoid,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function toData(input: z.infer<typeof objectionSchema>, createdById?: string) {
  return {
    scene: input.scene,
    title: input.title,
    concern: input.concern,
    keywordsJson: JSON.stringify(input.keywords),
    thinkingJson: JSON.stringify(input.thinking),
    scriptsJson: JSON.stringify(input.scripts),
    avoid: input.avoid,
    status: input.status,
    ...(createdById ? { createdById } : {}),
  }
}

function splitList(value: string) {
  return value
    .split(/\n{2,}|[;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitKeywords(value: string) {
  return value
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeScene(value: string, fallback: string) {
  const scene = String(value || '').trim()
  const map: Record<string, string> = {
    pre: 'pre',
    PRE: 'pre',
    课前: 'pre',
    课前进线: 'pre',
    mid: 'mid',
    MID: 'mid',
    课中: 'mid',
    课中推进: 'mid',
    close: 'close',
    CLOSE: 'close',
    结转: 'close',
    结转促单: 'close',
  }
  return map[scene] || fallback
}

function parseCsvLine(line: string) {
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

    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

export function parseObjectionImportText(text: string, defaultScene = 'pre') {
  const rows = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^场景[\t,，]/.test(line) && !/^scene[\t,]/i.test(line))

  const items = rows.map((line, index) => {
    const cells = line.includes('\t') ? line.split('\t').map((cell) => cell.trim()) : parseCsvLine(line)

    if (cells.length < 6) {
      throw new HttpError(400, `第 ${index + 1} 行格式不正确，请至少包含：场景、异议、顾虑、关键词、思路、话术、禁忌`)
    }

    const [scene, title, concern, keywords, thinking, scripts, avoid = '请补充禁忌提醒', status = 'ACTIVE'] = cells
    return objectionSchema.parse({
      scene: normalizeScene(scene, defaultScene),
      title,
      concern,
      keywords: splitKeywords(keywords),
      thinking: splitList(thinking),
      scripts: splitList(scripts),
      avoid,
      status: status === 'INACTIVE' || status === '已下架' ? 'INACTIVE' : 'ACTIVE',
    })
  })

  return items
}

export async function listObjectionsForTeacher(scene?: string, keyword?: string) {
  if (scene) {
    sceneSchema.parse(scene)
  }

  const items = await prisma.objectionItem.findMany({
    where: {
      status: 'ACTIVE',
      ...(scene ? { scene } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  })

  const mapped = items.map(mapObjection)
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  if (!normalizedKeyword) return mapped

  return mapped.filter((item: ReturnType<typeof mapObjection>) =>
    [item.title, item.concern, item.avoid, ...item.keywords, ...item.thinking, ...item.scripts]
      .join(' ')
      .toLowerCase()
      .includes(normalizedKeyword)
  )
}

export async function listObjectionsForAdmin(scene?: string, status?: string, keyword?: string) {
  if (scene) {
    sceneSchema.parse(scene)
  }
  if (status && status !== 'all') {
    statusSchema.parse(status)
  }

  const items = await prisma.objectionItem.findMany({
    where: {
      ...(scene ? { scene } : {}),
      ...(status && status !== 'all' ? { status } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  })

  const mapped = items.map(mapObjection)
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  if (!normalizedKeyword) return mapped

  return mapped.filter((item: ReturnType<typeof mapObjection>) =>
    [item.title, item.concern, item.avoid, ...item.keywords, ...item.thinking, ...item.scripts]
      .join(' ')
      .toLowerCase()
      .includes(normalizedKeyword)
  )
}

export async function createObjection(createdById: string, payload: unknown) {
  const input = objectionSchema.parse(payload)
  const item = await prisma.objectionItem.create({
    data: toData(input, createdById),
  })
  return mapObjection(item)
}

export async function updateObjection(objectionId: string, payload: unknown) {
  const input = objectionSchema.parse(payload)
  const existing = await prisma.objectionItem.findUnique({ where: { id: objectionId } })
  if (!existing) {
    throw new HttpError(404, '异议内容不存在')
  }

  const item = await prisma.objectionItem.update({
    where: { id: objectionId },
    data: toData(input),
  })
  return mapObjection(item)
}

export async function updateObjectionStatus(objectionId: string, status: unknown) {
  const input = statusSchema.parse(status)
  const existing = await prisma.objectionItem.findUnique({ where: { id: objectionId } })
  if (!existing) {
    throw new HttpError(404, '异议内容不存在')
  }

  const item = await prisma.objectionItem.update({
    where: { id: objectionId },
    data: { status: input },
  })
  return mapObjection(item)
}

export async function importObjections(createdById: string, payload: unknown) {
  const input = importSchema.parse(payload)
  const items = input.items.map((item) =>
    objectionSchema.parse({
      ...item,
      scene: item.scene || input.defaultScene,
      status: item.status || 'ACTIVE',
    })
  )

  const created = await prisma.$transaction(
    items.map((item) =>
      prisma.objectionItem.create({
        data: toData(item, createdById),
      })
    )
  )

  return {
    total: created.length,
    created: created.length,
    results: created.map(mapObjection),
  }
}
