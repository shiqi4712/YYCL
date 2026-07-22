import mammoth from 'mammoth'
import { HttpError } from '../utils/http-error'

const MAX_TEXT_LENGTH = 50_000

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function assertTextSize(text: string, label: string) {
  if (!text) {
    throw new HttpError(400, `未能从文档中读取到${label}内容`)
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new HttpError(400, `${label}内容过长，请控制在 ${MAX_TEXT_LENGTH} 字以内`)
  }

  return text
}

export async function extractTextFromFile(file: Express.Multer.File, label = '') {
  const originalName = file.originalname.toLowerCase()

  if (originalName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer })
    return assertTextSize(normalizeText(result.value), label)
  }

  if (
    originalName.endsWith('.txt') ||
    originalName.endsWith('.md') ||
    originalName.endsWith('.csv')
  ) {
    return assertTextSize(normalizeText(file.buffer.toString('utf8')), label)
  }

  throw new HttpError(400, '当前仅支持上传 .docx、.txt、.md、.csv 格式的文档')
}

export async function extractSopTextFromFile(file: Express.Multer.File) {
  return extractTextFromFile(file, 'SOP')
}

export function normalizeSopText(value: unknown) {
  return assertTextSize(normalizeText(String(value || '')), 'SOP')
}
