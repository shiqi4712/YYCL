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

export function isDeepSeekEnabled() {
  return env.aiProvider.toLowerCase() === 'deepseek' && Boolean(env.deepseekApiKey)
}

function buildParentPrompt(input: DeepSeekReplyInput) {
  return [
    '你正在为少儿编程体验课转化训练系统扮演一位真实家长。',
    '你只输出家长会说的话，不要解释你的判断，不要评分，不要输出 JSON。',
    '语气要自然、口语化、有犹豫和追问，不要太配合老师。',
    '不要直接说“进入下一个异议”或“你已经解决了这个异议”。',
    '如果老师回答空泛，你要继续围绕当前顾虑追问。',
    '如果老师回答较好，你可以稍微松动，但仍保持真实家长的谨慎。',
    `家长称呼：${input.parentName}`,
    `家长情况：${input.parentPersona}`,
    `训练场景：${input.scenarioTitle}`,
    `场景说明：${input.scenarioDescription}`,
    `当前核心顾虑：${input.currentStepTitle} - ${input.currentObjection}`,
    input.nextObjection ? `后续可能出现的顾虑：${input.nextObjection}` : '这是最后一个核心顾虑。',
    `系统初步判断老师是否解决当前顾虑：${input.resolved ? '基本解决' : '尚未充分解决'}`,
    `老师刚才的话：${input.teacherMessage}`,
    '请用 1 到 3 句话回复老师，保持家长口吻。',
  ].join('\n')
}

export async function buildDeepSeekReply(input: DeepSeekReplyInput) {
  const messages: DeepSeekChatMessage[] = [
    {
      role: 'system',
      content: '你是一个真实、谨慎、有顾虑的家长，用中文口语化回复老师。',
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
      temperature: 0.8,
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
