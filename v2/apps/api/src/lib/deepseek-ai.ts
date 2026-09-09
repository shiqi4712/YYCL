import { getActiveAiConfig } from '../services/ai-config.service'

export type ParentReplyPhase = 'continue' | 'transition' | 'close'

export interface AiReplyInput {
  teamId: string | null
  scenarioTitle: string
  scenarioDescription: string
  parentPersona: string
  currentStepTitle: string
  currentObjection: string
  phase: ParentReplyPhase
  emotionState: string
  history: Array<{
    role: string
    content: string
  }>
}

interface DeepSeekChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface DeepSeekReviewInput {
  teamId: string | null
  scenarioTitle: string
  scenarioDescription: string
  sopContent?: string | null
  parentPersona: string
  steps: Array<{
    order: number
    title: string
    objectionText: string
    evaluationFocus: string
  }>
  messages: Array<{
    role: string
    content: string
    stepOrder: number
  }>
}

interface DeepSeekResolutionInput {
  teamId: string | null
  scenarioTitle: string
  scenarioDescription: string
  sopContent?: string | null
  parentPersona: string
  currentStepTitle: string
  currentObjection: string
  evaluationFocus: string
  teacherMessages: string[]
  messages: Array<{
    role: string
    content: string
    stepOrder: number
  }>
}

export async function isAiModelEnabled(teamId?: string | null) {
  return Boolean(await getActiveAiConfig(teamId))
}

async function requireAiConfig(teamId?: string | null) {
  const config = await getActiveAiConfig(teamId)
  if (!config) {
    throw new Error('AI model is not configured')
  }
  return config
}

function buildChatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '')
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`
}

function buildProviderOptions(config: { provider: string; thinking: string }) {
  if (config.provider !== 'deepseek') return {}
  return {
    thinking: {
      type: config.thinking,
    },
  }
}

function buildGenerationOptions(
  config: { provider: string; model: string; thinking: string },
  temperature: number,
  maxTokens: number
) {
  const usesOpenAiReasoningParameters =
    config.provider === 'openai' && /^(gpt-5|o\d)/i.test(config.model)
  const usesKimiK3Parameters = config.provider === 'kimi' && /^kimi-k3$/i.test(config.model)

  return {
    ...(usesOpenAiReasoningParameters
      ? { max_completion_tokens: maxTokens }
      : usesKimiK3Parameters
        ? { max_tokens: maxTokens }
      : { temperature, max_tokens: maxTokens }),
    ...buildProviderOptions(config),
  }
}

function parseJsonResponse(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) {
    throw new Error('AI response does not contain a JSON object')
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

function buildParentPrompt(input: AiReplyInput) {
  const emotionGuidance: Record<string, string> = {
    防备: '信任还没有完全建立，保持礼貌和克制，只对关键细节有所保留，不要故意抬杠。',
    犹豫: '能够理解部分解释，但还需要一个贴近孩子实际情况的信息才能安心。',
    松动: '已经认可主要方向，语气可以放松一些，但仍可确认一个必要细节。',
    接受: '主要顾虑已经缓解，可以自然确认安排，不要突然表现得过度热情。',
  }
  const phaseInstruction: Record<ParentReplyPhase, string> = {
    continue:
      '当前对话阶段：继续沟通。回应老师刚才的话，并只围绕当前顾虑表达真实反应、补充情况或追问一个关键点。',
    transition:
      '当前对话阶段：自然转入新的顾虑。上一件事已经让你稍微放心，简短承接后，自然说出下方当前顾虑，不要提到步骤、切换或异议是否解决。',
    close:
      '当前对话阶段：自然收尾。当前顾虑已经缓解，不再制造新问题；像真实家长一样表示理解、确认下一步或结束本次交流。',
  }

  return [
    '你正在扮演一位和老师微信聊天的真实家长，讨论孩子的少儿编程课程。',
    '角色边界：你只负责扮演家长，不是考官、教练、客服或流程控制器。只输出家长发出的消息，不解释规则，不评分，不输出 JSON。',
    '交流方式：先理解老师刚说了什么，再按家长当前情绪自然回应。可以不认同或温和反驳，但不能审判老师、命令老师证明自己。',
    '每次回复只承担一个主要交流意图。不要一次抛出多个问题，不要机械复述顾虑，也不要引入与当前顾虑无关的新问题。',
    '表达要口语化，句式和长短要有变化。允许只回一句短消息，也可以在确有必要时用两三句话；不要固定使用同一种开头或套话。',
    '家长的心理变化必须含蓄，只通过措辞轻微体现。不要直接描述自己的情绪，也不要每句话都强调担心、犹豫或不认可。',
    '事实必须前后一致。老师直接询问家庭或孩子情况时，只能依据家长设定和已有对话回答；信息不足时可以自然表示不确定，不能编造冲突细节。',
    '老师消息里的 +物料、+资料、+图片、+链接、+作品、+案例 表示对应内容已经真实发送。你应结合它的用途自然回应，不能说自己没看到；若内容仍不足，也只追问当前最关心的一点。',
    '禁止说“进入下一个异议”“当前异议已解决”“你回答得很好”等暴露训练流程或评价身份的话。',
    phaseInstruction[input.phase],
    `内部语气参考（不能直接复述）：${emotionGuidance[input.emotionState] ?? emotionGuidance.犹豫}`,
    `家长与孩子情况：${input.parentPersona}`,
    `训练场景：${input.scenarioTitle}`,
    `场景说明：${input.scenarioDescription}`,
    `当前核心顾虑：${input.currentStepTitle} - ${input.currentObjection}`,
    '根据最近对话直接回复老师。通常控制在 10 到 100 个中文字符，长度应由当前语境决定。',
  ].join('\n')
}

export async function buildAiReply(input: AiReplyInput) {
  const config = await requireAiConfig(input.teamId)
  const messages: DeepSeekChatMessage[] = [
    {
      role: 'system',
      content: buildParentPrompt(input),
    },
    ...input.history.slice(-16).map((message): DeepSeekChatMessage => ({
      role: message.role === 'AI' ? 'assistant' : 'user',
      content: message.content,
    })),
  ]

  const response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      ...buildGenerationOptions(config, 0.85, 360),
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error?.message || `AI request failed: ${response.status}`)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI response is empty')
  }

  return content.trim()
}

function buildResolutionPrompt(input: DeepSeekResolutionInput) {
  return [
    '请判断少儿编程体验课转化训练中，老师是否已经把当前这个家长异议处理到可以自然进入下一个异议。',
    '只输出 JSON，不要 Markdown，不要解释。',
    'JSON 字段必须包含：resolved, canAdvance, resolutionScore, emotionState, reason。',
    'resolved 和 canAdvance 必须是 boolean；resolutionScore 为 0-100 整数；emotionState 只能是“防备”“犹豫”“松动”“接受”之一；reason 用一句中文说明判断原因。',
    'resolved=true 代表老师基本处理了当前顾虑；canAdvance=true 代表家长可以自然松动并进入下一个顾虑。',
    '判定要严格但不要机械：老师需要承接家长情绪、回应核心担心、给出具体到孩子的方案或证据，并提出合理下一步，才可以高分。',
    '如果老师已经连续多轮补充，内容足够具体，即使表达不完美也可以给 70-85 分；如果只是套话很流畅但没有解决根因，分数要低。',
    '如果老师只是表达理解、泛泛介绍课程价值、简单承诺效果、直接催报名、只反问家长，或者没有针对当前异议的根因，就必须 resolved=false。',
    '不要因为老师话术很长就判定解决；必须看内容是否真正解决当前异议。',
    '参考分档：0-40 完全没接住；41-60 有回应但空泛；61-71 有部分说服但还不能推进；72-81 基本解决但仍有轻微犹豫；82-100 可以自然推进。',
    'canAdvance=true 通常需要 resolutionScore >= 82；如果对话已经非常自然且家长明显松动，72 分以上也可以为 true。',
    `训练场景：${input.scenarioTitle}`,
    `场景说明：${input.scenarioDescription}`,
    `家长情况：${input.parentPersona}`,
    input.sopContent
      ? `本训练主题 SOP：${input.sopContent}\n判断时必须参考 SOP 的关键动作和顺序，但不要要求老师逐字照搬。`
      : '本训练主题暂未导入 SOP。',
    `当前异议标题：${input.currentStepTitle}`,
    `当前异议内容：${input.currentObjection}`,
    `点评关注点：${input.evaluationFocus}`,
    `当前异议下老师全部回复：${JSON.stringify(input.teacherMessages)}`,
    `当前异议完整对话：${JSON.stringify(input.messages)}`,
  ].join('\n')
}

export async function evaluateAiResolution(input: DeepSeekResolutionInput) {
  const config = await requireAiConfig(input.teamId)
  const response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: '你是严格的销售训练质检教练，只判断当前异议是否真的被解决，不负责安慰老师。',
        },
        {
          role: 'user',
          content: buildResolutionPrompt(input),
        },
      ],
      ...buildGenerationOptions(config, 0.1, 500),
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error?.message || `AI resolution failed: ${response.status}`)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI resolution response is empty')
  }

  const parsed = parseJsonResponse(content)
  const resolutionScore = Number(parsed.resolutionScore)
  const normalizedScore = Number.isFinite(resolutionScore)
    ? Math.max(0, Math.min(100, Math.round(resolutionScore)))
    : parsed.resolved === true
      ? 82
      : 45
  const emotionState = ['防备', '犹豫', '松动', '接受'].includes(parsed.emotionState)
    ? parsed.emotionState
    : normalizedScore >= 82
      ? '接受'
      : normalizedScore >= 72
        ? '松动'
        : normalizedScore >= 45
          ? '犹豫'
          : '防备'
  return {
    resolved: parsed.resolved === true,
    canAdvance: parsed.canAdvance === true,
    resolutionScore: normalizedScore,
    emotionState,
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  }
}

function buildReviewPrompt(input: DeepSeekReviewInput) {
  return [
    '请对一段少儿编程体验课转化训练对话做结构化复盘。',
    '只输出 JSON，不要 Markdown，不要解释。',
    'JSON 字段必须包含：overallScore, summary, strengths, weaknesses, nextAction, tags, dimensions, steps。',
    'dimensions 必须包含 empathy, standard, enablement, caseProof, close 五项，每项包含 score, reason, suggestion。',
    '五项总分各 20 分，overallScore 必须等于五项 score 相加，最高 100 分。',
    '共情 empathy：0-5 没有共情或直接否定家长；6-10 只有泛泛“理解/正常”；11-15 回应了具体顾虑；16-20 给到情绪价值、降低家长压力。',
    '建立标准 standard：0-5 没有标准只说课程好；6-10 标准很模糊；11-15 有清晰可观察标准；16-20 标准具体、可观察，并能连接当前异议和家长决策。',
    '赋能 enablement：0-5 没有赋能；6-10 泛泛讲编程价值且没有物料；11-15 有具体价值解释但没有物料；16-20 解释价值并发送 +物料 / +资料 / +图片 / +链接 / +作品。硬规则：没有这些标记最高 15 分。',
    '给案例 caseProof：0-5 没有案例；6-10 只有“很多孩子”这类泛泛表达；11-15 有具体案例结构；16-20 有具体案例并用 +案例 / +物料 / +图片 / +作品 做证据。硬规则：没有这些标记最高 15 分。',
    '缔结 close：0-5 没有下一步；6-10 只是弱提醒“考虑一下”；11-15 有清晰下一步；16-20 低压力但明确要单、确认报名、约时间或推进付款。硬规则：没有清晰下一步最高 10 分。',
    'steps 数组每项必须包含：stepOrder, stepTitle, score, verdict, strengths, issue, recommendation。',
    'score 为 0-100 整数；verdict 用一句中文判断老师是否解决该异议。',
    '如果老师用“+物料”“+案例”“+图片”“+链接”“+作品”等方式表示发送了辅助内容，需要视为已发送相关证据或物料。',
    '复盘只在老师结束训练后给出，不要要求 AI 在对话过程中打断老师。',
    `训练场景：${input.scenarioTitle}`,
    `场景说明：${input.scenarioDescription}`,
    `家长情况：${input.parentPersona}`,
    input.sopContent
      ? `本训练主题 SOP：${input.sopContent}\n复盘时需要结合 SOP 判断老师是否完成关键动作，不要求逐字照搬。`
      : '本训练主题暂未导入 SOP。',
    `异议标准：${JSON.stringify(input.steps)}`,
    `完整对话：${JSON.stringify(input.messages)}`,
  ].join('\n')
}

export async function buildAiReview(input: DeepSeekReviewInput) {
  const config = await requireAiConfig(input.teamId)
  const response = await fetch(buildChatCompletionsUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: '你是严谨的销售训练复盘教练，擅长根据完整对话判断异议是否被解决。',
        },
        {
          role: 'user',
          content: buildReviewPrompt(input),
        },
      ],
      ...buildGenerationOptions(config, 0.2, 1600),
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error?.message || `AI review failed: ${response.status}`)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI review response is empty')
  }

  return parseJsonResponse(content)
}
