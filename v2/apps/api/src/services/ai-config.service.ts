import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

const aiConfigSchema = z.object({
  isEnabled: z.boolean().default(false),
  apiKey: z.string().trim().max(5000).optional(),
  baseUrl: z.string().trim().url().max(191).default('https://api.deepseek.com'),
  model: z.string().trim().min(1).max(191).default('deepseek-v4-flash'),
  thinking: z.enum(['disabled', 'enabled']).default('disabled'),
})

function maskApiKey(apiKey?: string | null) {
  if (!apiKey) return null
  const text = apiKey.trim()
  if (text.length <= 8) return '已配置'
  return `${text.slice(0, 4)}****${text.slice(-4)}`
}

async function getOrCreateDeepSeekConfig() {
  const existing = await prisma.aiConfig.findUnique({
    where: { provider: 'deepseek' },
  })

  if (existing) return existing

  return prisma.aiConfig.create({
    data: {
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      thinking: 'disabled',
      isEnabled: false,
    },
  })
}

export async function getAiConfigForAdmin() {
  const config = await getOrCreateDeepSeekConfig()

  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    thinking: config.thinking,
    isEnabled: config.isEnabled,
    hasApiKey: Boolean(config.apiKey),
    apiKeyPreview: maskApiKey(config.apiKey),
    updatedAt: config.updatedAt,
  }
}

export async function updateAiConfigForAdmin(payload: unknown) {
  const input = aiConfigSchema.parse(payload)
  const existing = await getOrCreateDeepSeekConfig()
  const apiKey = input.apiKey?.trim()
  const nextApiKey = apiKey ? apiKey : existing.apiKey

  if (input.isEnabled && !nextApiKey) {
    throw new HttpError(400, '启用 DeepSeek 前请先填写 API Key')
  }

  const config = await prisma.aiConfig.update({
    where: { id: existing.id },
    data: {
      baseUrl: input.baseUrl.replace(/\/$/, ''),
      model: input.model,
      thinking: input.thinking,
      isEnabled: input.isEnabled,
      ...(apiKey ? { apiKey } : {}),
    },
  })

  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    thinking: config.thinking,
    isEnabled: config.isEnabled,
    hasApiKey: Boolean(config.apiKey),
    apiKeyPreview: maskApiKey(config.apiKey),
    updatedAt: config.updatedAt,
  }
}

export async function getActiveDeepSeekConfig() {
  const config = await prisma.aiConfig.findUnique({
    where: {
      provider: 'deepseek',
    },
  })

  if (!config?.isEnabled || !config.apiKey) return null

  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || 'https://api.deepseek.com',
    model: config.model || 'deepseek-v4-flash',
    thinking: config.thinking || 'disabled',
  }
}
