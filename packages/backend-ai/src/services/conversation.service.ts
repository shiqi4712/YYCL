import axios from 'axios'
import { deepseek } from './deepseek.service'
import { buildParentPrompt } from './prompt-engine/parent-role.prompt'
import { buildReviewPrompt } from './prompt-engine/review.prompt'

const CORE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3001'

interface Message {
  role: 'TEACHER' | 'AI'
  content: string
}

// In-memory session store (use node-cache or Redis in production)
const sessions = new Map<number, {
  scenarioId: number
  messages: Message[]
  status: string
  roundCount: number
}>()

export async function createSession(scenarioId: number) {
  // Fetch scenario from core service
  const res = await axios.get(`${CORE_URL}/api/scenarios/${scenarioId}`)
  const scenario = res.data.data

  const sessionId = Date.now() + Math.floor(Math.random() * 1000)
  const initialMessage = scenario.initialMessage

  sessions.set(sessionId, {
    scenarioId,
    messages: [{ role: 'AI', content: initialMessage }],
    status: 'ACTIVE',
    roundCount: 1
  })

  // Save conversation to core DB
  const convRes = await axios.post(`${CORE_URL}/api/chat/sessions`, {
    scenarioId,
    initialMessage
  })

  return {
    sessionId: convRes.data.data?.id || sessionId,
    initialMessage
  }
}

export async function sendMessage(sessionId: number, content: string) {
  const session = sessions.get(sessionId)
  if (!session) throw { status: 404, message: '对话不存在' }
  if (session.status !== 'ACTIVE') throw { status: 400, message: '对话已结束' }
  if (session.roundCount >= 20) {
    session.status = 'TIMEOUT'
    throw { status: 400, message: '对话轮次已达上限' }
  }

  session.messages.push({ role: 'TEACHER', content })
  session.roundCount++

  // Fetch scenario for prompt
  const res = await axios.get(`${CORE_URL}/api/scenarios/${session.scenarioId}`)
  const scenario = res.data.data

  const systemPrompt = buildParentPrompt(scenario)
  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...session.messages.map(m => ({
      role: m.role === 'TEACHER' ? 'user' as const : 'assistant' as const,
      content: m.content
    }))
  ]

  const reply = await deepseek.chat(chatMessages)

  session.messages.push({ role: 'AI', content: reply })

  // Simple heuristics for conversation end
  const lowerReply = reply.toLowerCase()
  if (lowerReply.includes('报名') || lowerReply.includes('交钱') || lowerReply.includes('好的，我') || lowerReply.includes('订了')) {
    session.status = 'COMPLETED'
  }
  if (lowerReply.includes('不考虑') || lowerReply.includes('不需要') || lowerReply.includes('别联系') || lowerReply.includes('挂了')) {
    session.status = 'FAILED'
  }

  return {
    role: 'AI',
    content: reply,
    createdAt: new Date().toISOString()
  }
}

export async function getConversation(sessionId: number) {
  const session = sessions.get(sessionId)
  if (!session) throw { status: 404, message: '对话不存在' }
  return {
    messages: session.messages.map((m, idx) => ({
      id: idx + 1,
      ...m,
      messageType: 'TEXT',
      createdAt: new Date().toISOString()
    })),
    status: session.status
  }
}

export async function endConversation(sessionId: number) {
  const session = sessions.get(sessionId)
  if (!session) throw { status: 404, message: '对话不存在' }
  if (session.status === 'ACTIVE') {
    session.status = 'COMPLETED'
  }
  return { id: sessionId, status: session.status }
}

export async function generateReview(sessionId: number) {
  const session = sessions.get(sessionId)
  if (!session) throw { status: 404, message: '对话不存在' }

  const res = await axios.get(`${CORE_URL}/api/scenarios/${session.scenarioId}`)
  const scenario = res.data.data

  const promptMessages = [
    { role: 'system' as const, content: '你是一位资深销售培训专家。' },
    { role: 'user' as const, content: buildReviewPrompt(scenario, session.messages) }
  ]

  const review = await deepseek.chatWithJsonOutput(promptMessages, 0.5)
  return review
}
