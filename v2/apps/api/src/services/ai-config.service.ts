import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { HttpError } from '../utils/http-error'

const aiProviderSchema = z.enum(['deepseek', 'kimi', 'openai', 'qwen', 'glm', 'doubao', 'custom'])
const aiConfigSchema = z.object({
  provider: aiProviderSchema.default('deepseek'),
  isEnabled: z.boolean().default(false),
  apiKey: z.string().trim().max(5000).optional(),
  baseUrl: z.string().trim().url().max(191).default('https://api.deepseek.com'),
  model: z.string().trim().min(1).max(191).default('deepseek-v4-flash'),
  thinking: z.enum(['disabled', 'enabled']).default('disabled'),
  maxConcurrentUsers: z.coerce.number().int().min(1).max(30).default(10),
})

const providerDefaults: Record<z.infer<typeof aiProviderSchema>, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k3' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: '' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: '' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
  custom: { baseUrl: '', model: '' },
}

function maskApiKey(apiKey?: string | null) {
  if (!apiKey) return null
  const text = apiKey.trim()
  if (text.length <= 8) return '已配置'
  return `${text.slice(0, 4)}****${text.slice(-4)}`
}

function toAdminConfig(config: any, provider: z.infer<typeof aiProviderSchema>) {
  const defaults = providerDefaults[provider]
  return {
    provider,
    baseUrl: config?.baseUrl ?? defaults.baseUrl,
    model: config?.model ?? defaults.model,
    thinking: config?.thinking ?? 'disabled',
    maxConcurrentUsers: config?.maxConcurrentUsers ?? 10,
    isEnabled: Boolean(config?.isEnabled),
    hasApiKey: Boolean(config?.apiKey),
    apiKeyPreview: maskApiKey(config?.apiKey),
    updatedAt: config?.updatedAt ?? null,
  }
}

export async function getAiConfigForAdmin(providerValue?: unknown) {
  const requestedProvider = aiProviderSchema.safeParse(providerValue)
  if (requestedProvider.success) {
    const config = await prisma.aiConfig.findUnique({
      where: { provider: requestedProvider.data },
    })
    return toAdminConfig(config, requestedProvider.data)
  }

  const config = await prisma.aiConfig.findFirst({
    orderBy: [{ isEnabled: 'desc' }, { updatedAt: 'desc' }],
  })
  const provider = aiProviderSchema.safeParse(config?.provider)
  return toAdminConfig(config, provider.success ? provider.data : 'deepseek')
}

function buildChatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '')
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`
}

const providerLabels: Record<z.infer<typeof aiProviderSchema>, string> = {
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
  openai: 'OpenAI',
  qwen: '通义千问',
  glm: '智谱 GLM',
  doubao: '豆包',
  custom: '模型服务',
}

function getProviderErrorMessage(
  provider: z.infer<typeof aiProviderSchema>,
  status: number,
  payload: any
) {
  const providerLabel = providerLabels[provider]
  const errorCode = String(payload?.error?.code || payload?.code || '').toLowerCase()
  const upstreamMessage = String(payload?.error?.message || payload?.message || '').toLowerCase()
  const errorText = `${errorCode} ${upstreamMessage}`

  if (/insufficient[ _-]?balance|balance.*insufficient|quota.*exceed|余额不足|欠费|suspend/.test(errorText)) {
    return `${providerLabel} 账户余额不足或计费账户已暂停，请充值或更换有余额的 API Key 后重试`
  }
  if (status === 401 || /invalid.*(api[ _-]?key|authentication)|unauthorized|鉴权|密钥.*无效/.test(errorText)) {
    return `${providerLabel} API Key 无效或已失效，请重新填写 API Key`
  }
  if (/model.*(not found|does not exist|invalid|unsupported)|模型.*(不存在|无效|不支持)/.test(errorText)) {
    return `模型名称无效或当前账户无权使用，请填写 ${providerLabel} 控制台中显示的模型 ID`
  }
  if (status === 429 || /rate[ _-]?limit|too many requests|限流|请求过于频繁/.test(errorText)) {
    return `${providerLabel} 当前请求过于频繁或额度已用完，请稍后重试并检查账户额度`
  }
  if (status === 403) {
    return `${providerLabel} 拒绝了当前请求，请检查 API Key 权限和模型访问权限`
  }
  if (status === 404) {
    return `未找到模型接口，请检查 Base URL 和模型名称`
  }
  if (status === 400) {
    return `${providerLabel} 拒绝了测试请求，请检查模型名称及该模型支持的参数`
  }

  return `${providerLabel} 服务暂时不可用（HTTP ${status}），请稍后重试`
}

export async function testAiConfigForAdmin(providerValue: unknown) {
  const provider = aiProviderSchema.parse(providerValue)
  const config = await prisma.aiConfig.findUnique({ where: { provider } })

  if (!config?.apiKey) {
    throw new HttpError(400, '请先保存该服务商的 API Key')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  const startedAt = Date.now()

  try {
    const usesOpenAiReasoningParameters =
      provider === 'openai' && /^(gpt-5|o\d)/i.test(config.model)
    const usesKimiK3Parameters = provider === 'kimi' && /^kimi-k3$/i.test(config.model)
    const response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: '这是连通性测试，请只回复“连接成功”。' }],
        ...(usesOpenAiReasoningParameters
          ? { max_completion_tokens: 128 }
          : usesKimiK3Parameters
            ? { max_tokens: 128 }
          : { temperature: 0, max_tokens: 128 }),
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new HttpError(502, getProviderErrorMessage(provider, response.status, payload))
    }

    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new HttpError(502, '模型已响应，但没有返回有效文本，请检查模型名称')
    }

    return {
      success: true,
      provider,
      model: config.model,
      latencyMs: Date.now() - startedAt,
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError(504, '连接模型超时，请检查 Base URL、网络或服务商状态')
    }
    throw new HttpError(502, error instanceof Error ? `无法连接模型服务：${error.message}` : '无法连接模型服务')
  } finally {
    clearTimeout(timeout)
  }
}

export async function updateAiConfigForAdmin(payload: unknown) {
  const input = aiConfigSchema.parse(payload)
  const existing = await prisma.aiConfig.findUnique({
    where: { provider: input.provider },
  })
  const apiKey = input.apiKey?.trim()
  const nextApiKey = apiKey || existing?.apiKey

  if (input.isEnabled && !nextApiKey) {
    throw new HttpError(400, '启用 AI 模型前请先填写 API Key')
  }

  const saveConfig = prisma.aiConfig.upsert({
    where: { provider: input.provider },
    create: {
      provider: input.provider,
      apiKey: apiKey || null,
      baseUrl: input.baseUrl.replace(/\/$/, ''),
      model: input.model,
      thinking: input.thinking,
      maxConcurrentUsers: input.maxConcurrentUsers,
      isEnabled: input.isEnabled,
    },
    update: {
      baseUrl: input.baseUrl.replace(/\/$/, ''),
      model: input.model,
      thinking: input.thinking,
      maxConcurrentUsers: input.maxConcurrentUsers,
      isEnabled: input.isEnabled,
      ...(apiKey ? { apiKey } : {}),
    },
  })

  let config
  if (input.isEnabled) {
    const [, savedConfig] = await prisma.$transaction([
      prisma.aiConfig.updateMany({
        where: { provider: { not: input.provider } },
        data: { isEnabled: false },
      }),
      saveConfig,
    ])
    config = savedConfig
  } else {
    config = await saveConfig
  }

  return toAdminConfig(config, input.provider)
}

export async function getActiveAiConfig() {
  const config = await prisma.aiConfig.findFirst({
    where: { isEnabled: true },
    orderBy: { updatedAt: 'desc' },
  })

  if (!config?.isEnabled || !config.apiKey) return null
  const provider = aiProviderSchema.safeParse(config.provider)

  return {
    provider: provider.success ? provider.data : 'custom',
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    thinking: config.thinking || 'disabled',
    maxConcurrentUsers: config.maxConcurrentUsers || 10,
  }
}

export async function getConfiguredConcurrentUserLimit() {
  const config = await prisma.aiConfig.findFirst({
    orderBy: [{ isEnabled: 'desc' }, { updatedAt: 'desc' }],
  })
  return Math.max(1, Math.min(30, config?.maxConcurrentUsers || 10))
}
