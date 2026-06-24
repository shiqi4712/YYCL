import { env } from '../env'

interface DeepSeekReplyInput {
  parentName: string
  scenarioTitle: string
  scenarioDescription: string
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

function buildReviewPrompt(input: DeepSeekReviewInput) {
  return [
    '请对一段少儿编程体验课转化训练对话做结构化复盘。',
    '只输出 JSON，不要 Markdown，不要解释。',
    'JSON 字段必须包含：overallScore, summary, strengths, weaknesses, nextAction, tags, steps。',
    'steps 数组每项必须包含：stepOrder, stepTitle, score, verdict, strengths, issue, recommendation。',
    'score 为 0-100 整数；verdict 用一句中文判断老师是否解决该异议。',
    `训练场景：${input.scenarioTitle}`,
    `场景说明：${input.scenarioDescription}`,
    `家长情况：${input.parentPersona}`,
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
