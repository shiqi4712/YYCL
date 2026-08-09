import mammoth from 'mammoth'
import { TextDecoder } from 'node:util'
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

function textQualityScore(text: string) {
  const badChars = (text.match(/[�]/g) || []).length
  const suspiciousLatin = (text.match(/[ÃÂÅÆÇÈÉåæçèé]{1}/g) || []).length
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return chineseChars * 2 - badChars * 80 - suspiciousLatin * 12
}

function decodeTextBuffer(buffer: Buffer) {
  const texts = [buffer.toString('utf8')]
  for (const encoding of ['gb18030', 'gbk']) {
    try {
      texts.push(new TextDecoder(encoding).decode(buffer))
    } catch {
      // UTF-8 fallback remains available when a legacy decoder is unavailable.
    }
  }

  return Array.from(new Set(texts)).sort((a, b) => textQualityScore(b) - textQualityScore(a))[0]
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
    return assertTextSize(normalizeText(decodeTextBuffer(file.buffer)), label)
  }

  throw new HttpError(400, '当前仅支持上传 .docx、.txt、.md、.csv 格式的文档')
}

export async function extractSopTextFromFile(file: Express.Multer.File) {
  return extractTextFromFile(file, 'SOP')
}

export function normalizeSopText(value: unknown) {
  return assertTextSize(normalizeText(String(value || '')), 'SOP')
}
