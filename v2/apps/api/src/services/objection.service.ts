import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

const sceneSchema = z.enum(['pre', 'mid', 'close'])
const statusSchema = z.enum(['ACTIVE', 'INACTIVE'])
const materialSchema = z.object({
  type: z.enum(['LINK', 'IMAGE']).default('LINK'),
  title: z.string().min(1).max(80),
  url: z.string().min(1).max(1000),
  description: z.string().max(300).default(''),
})
const scriptSchema = z
  .union([
    z.string().min(1).max(2000),
    z.object({
      text: z.string().min(1).max(2000),
      materials: z.array(materialSchema).max(12).default([]),
    }),
  ])
  .transform((script) => (typeof script === 'string' ? { text: script, materials: [] } : script))
type ScriptItem = z.infer<typeof scriptSchema>

const objectionSchema = z.object({
  scene: sceneSchema,
  title: z.string().min(1).max(120),
  concern: z.string().max(1000).default(''),
  keywords: z.array(z.string().min(1).max(30)).max(20).default([]),
  thinking: z.array(z.string().min(1).max(500)).max(12).default([]),
  scripts: z.array(scriptSchema).max(12).default([]),
  materials: z.array(materialSchema).max(12).default([]),
  avoid: z.string().max(1000).default(''),
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

function normalizeScripts(value: unknown): ScriptItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((script) => {
      if (typeof script === 'string') {
        const text = script.trim()
        return text ? { text, materials: [] } : null
      }
      if (script && typeof script === 'object') {
        const candidate = script as { text?: unknown; materials?: unknown }
        const text = String(candidate.text || '').trim()
        if (!text) return null
        const materials = Array.isArray(candidate.materials)
          ? candidate.materials
              .map((material) => materialSchema.safeParse(material))
              .filter((result): result is z.SafeParseSuccess<z.infer<typeof materialSchema>> => result.success)
              .map((result) => result.data)
          : []
        return { text, materials }
      }
      return null
    })
    .filter((script): script is ScriptItem => Boolean(script))
}

function scriptSearchParts(scripts: ScriptItem[]) {
  return scripts.flatMap((script) => [
    script.text,
    ...script.materials.flatMap((material) => [material.title || '', material.url || '', material.description || '']),
  ])
}

function mapObjection(item: {
  id: string
  scene: string
  title: string
  concern: string
  keywordsJson: string
  thinkingJson: string
  scriptsJson: string
  materialsJson: string | null
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
    scripts: normalizeScripts(parseJsonArray(item.scriptsJson)),
    materials: parseJsonArray(item.materialsJson || '[]'),
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
    materialsJson: JSON.stringify(input.materials),
    avoid: input.avoid,
    status: input.status,
    ...(createdById ? { createdById } : {}),
  }
}

function splitList(value: string) {
  return String(value || '')
    .split(/\n{2,}|[;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitKeywords(value: string) {
  return String(value || '')
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitMaterials(value: string) {
  return String(value || '')
    .split(/\n{2,}|[;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [title, url, description = ''] = item.split(/[|｜]/).map((cell) => cell.trim())
      return materialSchema.parse({
        type: /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url || title) ? 'IMAGE' : 'LINK',
        title: title || '配套物料',
        url: url || title,
        description,
      })
    })
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

    if (cells.length < 2) {
      throw new HttpError(400, `第 ${index + 1} 行格式不正确，请至少包含：场景、异议问题`)
    }

    const hasMaterialsColumn = cells.length >= 9
    const [scene, title, concern = '', keywords = '', thinking = '', scripts = ''] = cells
    const materials = hasMaterialsColumn ? cells[6] : ''
    const avoid = hasMaterialsColumn ? cells[7] || '' : cells[6] || ''
    const status = hasMaterialsColumn ? cells[8] || 'ACTIVE' : cells[7] || 'ACTIVE'
    return objectionSchema.parse({
      scene: normalizeScene(scene, defaultScene),
      title,
      concern,
      keywords: splitKeywords(keywords),
      thinking: splitList(thinking),
      scripts: splitList(scripts),
      materials: splitMaterials(materials),
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
    [
      item.title,
      item.concern,
      item.avoid,
      ...item.keywords,
      ...item.thinking,
      ...scriptSearchParts(item.scripts),
      ...item.materials.flatMap((material: { title?: string; url?: string; description?: string }) => [
        material.title || '',
        material.url || '',
        material.description || '',
      ]),
    ]
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
    [
      item.title,
      item.concern,
      item.avoid,
      ...item.keywords,
      ...item.thinking,
      ...scriptSearchParts(item.scripts),
      ...item.materials.flatMap((material: { title?: string; url?: string; description?: string }) => [
        material.title || '',
        material.url || '',
        material.description || '',
      ]),
    ]
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
