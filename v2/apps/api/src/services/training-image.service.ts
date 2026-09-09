import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

const IMAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const CLEANUP_BATCH_SIZE = 500

export const trainingImageUploadDir = path.resolve(__dirname, '../../uploads/training')
export const trainingImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const imageExtensions: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export function createTrainingImageFileName(mimeType: string) {
  return `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${imageExtensions[mimeType] || '.img'}`
}

export function mapTrainingImage(image: {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  url: string
  fileDeletedAt: Date | null
  createdAt: Date
}) {
  return {
    id: image.id,
    name: image.originalName,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    url: image.fileDeletedAt ? null : image.url,
    isExpired: Boolean(image.fileDeletedAt),
    createdAt: image.createdAt,
  }
}

export async function assertTrainingImageUploadAllowed(sessionId: string, teacherId: string) {
  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, teacherId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (!session) {
    throw new HttpError(404, '训练记录不存在或已经结束')
  }
}

export async function saveTrainingImage(
  sessionId: string,
  teacherId: string,
  file: Express.Multer.File
) {
  try {
    const image = await prisma.trainingImage.create({
      data: {
        teacherId,
        sessionId,
        originalName: file.originalname.slice(0, 191),
        fileName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: `/uploads/training/${file.filename}`,
      },
    })
    return mapTrainingImage(image)
  } catch (error) {
    await fs.unlink(file.path).catch(() => undefined)
    throw error
  }
}

function resolveStoredImagePath(fileName: string) {
  const resolved = path.resolve(trainingImageUploadDir, fileName)
  if (!resolved.startsWith(`${trainingImageUploadDir}${path.sep}`)) {
    throw new Error('Invalid training image path')
  }
  return resolved
}

async function removeImageFiles(
  images: Array<{ id: string; fileName: string }>,
  options: { deleteRecords?: boolean } = {}
) {
  const removedIds: string[] = []
  for (const image of images) {
    try {
      await fs.unlink(resolveStoredImagePath(image.fileName))
      removedIds.push(image.id)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        removedIds.push(image.id)
      } else {
        console.error(`Failed to remove training image ${image.id}:`, error)
      }
    }
  }

  if (!removedIds.length) return 0
  if (options.deleteRecords) {
    await prisma.trainingImage.deleteMany({ where: { id: { in: removedIds } } })
  } else {
    await prisma.trainingImage.updateMany({
      where: { id: { in: removedIds } },
      data: { fileDeletedAt: new Date() },
    })
  }
  return removedIds.length
}

export async function deletePendingTrainingImage(imageId: string, sessionId: string, teacherId: string) {
  const image = await prisma.trainingImage.findFirst({
    where: { id: imageId, sessionId, teacherId, messageId: null },
    select: { id: true, fileName: true },
  })
  if (!image) {
    throw new HttpError(404, '待发送图片不存在')
  }
  await removeImageFiles([image], { deleteRecords: true })
  return { id: image.id }
}

export async function deleteTrainingImagesForTeachers(teacherIds: string[]) {
  const uniqueTeacherIds = Array.from(new Set(teacherIds))
  if (!uniqueTeacherIds.length) return 0
  const images = await prisma.trainingImage.findMany({
    where: { teacherId: { in: uniqueTeacherIds }, fileDeletedAt: null },
    select: { id: true, fileName: true },
  })
  return removeImageFiles(images)
}

export async function cleanupExpiredTrainingImages() {
  const cutoff = new Date(Date.now() - IMAGE_RETENTION_MS)
  let removedCount = 0

  while (true) {
    const images = await prisma.trainingImage.findMany({
      where: { fileDeletedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, fileName: true },
      take: CLEANUP_BATCH_SIZE,
    })
    if (!images.length) break
    const removed = await removeImageFiles(images)
    removedCount += removed
    if (removed === 0 || images.length < CLEANUP_BATCH_SIZE) break
  }

  if (removedCount) {
    console.log(`Removed ${removedCount} expired training image files`)
  }
  return removedCount
}

export function startTrainingImageCleanup() {
  void cleanupExpiredTrainingImages().catch((error) => {
    console.error('Initial training image cleanup failed:', error)
  })
  const timer = setInterval(() => {
    void cleanupExpiredTrainingImages().catch((error) => {
      console.error('Scheduled training image cleanup failed:', error)
    })
  }, CLEANUP_INTERVAL_MS)
  timer.unref()
}
