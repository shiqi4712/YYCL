import { env } from '../env'

interface DeepSeekReplyInput {
  parentName: string
  scenarioTitle: string
  scenarioDescription: string
  sopContent?: string | null
  parentPersona: string
  currentStepTitle: string
  currentObjection: string
  nextObjection?: string
  teacherMessage: string
  resolved: boolean
  canAdvance: boolean
  isFinalStep: boolean
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

export function isDeepSeekEnabled() {
  return env.aiProvider.toLowerCase() === 'deepseek' && Boolean(env.deepseekApiKey)
}

function buildParentPrompt(input: DeepSeekReplyInput) {
  return [
    '你正在为少儿编程体验课转化训练系统扮演一位真实家长，和老师像微信聊天一样沟通是否报名正式课。',
    '你只输出家长会说的话，不要解释你的判断，不要评分，不要输出 JSON。',
    '语气要自然、口语化、有犹豫和追问，不要太配合老师，也不要故意刁难老师。',
    '你要表现出真实家长的心理变化：从犹豫、防备，到逐渐理解，再到愿意继续了解。不要突然转变态度，每次只变化一点点。',
    '你可以反驳老师、不同意老师或继续提出担心，但要像正常家长聊天一样表达，不要像考官、培训师或系统提示。',
    '反驳时先接住老师表达的价值，再提出自己没有被说服的具体生活化原因。',
    '可以使用这类口吻：“我理解你说的，不过我还是有点担心...”“这个方向我明白，但我家孩子可能不太一样...”“我不是完全不认可，就是还差一点确定感...”。',
    '不要使用生硬、命令式、审判式表达，例如“你没有解决我的问题”“你必须讲清楚”“请具体一点”。',
    '不要连续抛出多个问题，优先围绕一个真实顾虑继续聊，语气可以谨慎、犹豫、稍微坚持，但不要攻击老师。',
    '不要机械复述当前异议，也不要每次都用同一个句式开头，回复要像真实家长临场说出来的话。',
    '不要直接说“进入下一个异议”或“你已经解决了这个异议”。',
    '如果老师回答空泛，你要继续围绕当前顾虑追问，但表达要生活化，比如“我大概懂你的意思，就是还想知道具体怎么落到我家孩子身上”。',
    '如果老师回答较好，你可以稍微松动，但在沟通还不充分时仍要继续围绕当前顾虑表达犹豫；不要因为一句回答就立刻成交。',
    input.canAdvance
      ? '当前沟通轮次和处理质量已经允许你自然松动，可以准备进入下一个担忧。'
      : '当前还不能进入下一个担忧，你必须继续围绕当前顾虑追问或表达犹豫。',
    `家长称呼：${input.parentName}`,
    `家长情况：${input.parentPersona}`,
    `训练场景：${input.scenarioTitle}`,
    `场景说明：${input.scenarioDescription}`,
    input.sopContent
      ? `本训练主题 SOP：${input.sopContent}\n请根据 SOP 的沟通顺序、话术目标和关键检查点来扮演家长，但不要直接背诵 SOP，也不要向老师暴露评分标准。`
      : '本训练主题暂未导入 SOP，请按当前场景和异议步骤进行模拟。',
    `当前核心顾虑：${input.currentStepTitle} - ${input.currentObjection}`,
    input.nextObjection ? `后续可能出现的顾虑：${input.nextObjection}` : '这是最后一个核心顾虑。',
    `系统初步判断老师是否解决当前顾虑：${input.resolved ? '基本解决' : '尚未充分解决'}`,
    `老师刚才的话：${input.teacherMessage}`,
    '请用 1 到 3 句话回复老师，像微信消息一样自然，通常控制在 30 到 90 个中文字符左右。',
  ].join('\n')
}

export async function buildDeepSeekReply(input: DeepSeekReplyInput) {
  const messages: DeepSeekChatMessage[] = [
    {
      role: 'system',
      content:
        '你是一个真实、谨慎、有顾虑的家长，用中文口语化回复老师。你可以温和反驳，但不要生硬顶撞，也不要像培训考官；回复要像微信聊天，有一点真实的犹豫和心理变化。',
    },
    ...input.history.slice(-10).map((message): DeepSeekChatMessage => ({
      role: message.role === 'AI' ? 'assistant' : 'user',
      content: message.content,
    })),
    {
      role: 'user',
      content: buildParentPrompt(input),
    },
  ]

  const response = await fetch(`${env.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.deepseekModel,
      messages,
      temperature: 0.85,
      max_tokens: 360,
      thinking: {
        type: env.deepseekThinking,
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error?.message || `DeepSeek request failed: ${response.status}`)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('DeepSeek response is empty')
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

export async function evaluateDeepSeekResolution(input: DeepSeekResolutionInput) {
  const response = await fetch(`${env.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.deepseekModel,
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
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      thinking: {
        type: env.deepseekThinking,
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error?.message || `DeepSeek resolution failed: ${response.status}`)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('DeepSeek resolution response is empty')
  }

  const parsed = JSON.parse(content)
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

export async function buildDeepSeekReview(input: DeepSeekReviewInput) {
  const response = await fetch(`${env.deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.deepseekModel,
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
      temperature: 0.2,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      thinking: {
        type: env.deepseekThinking,
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error?.message || `DeepSeek review failed: ${response.status}`)
  }

  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('DeepSeek review response is empty')
  }

  return JSON.parse(content)
}
