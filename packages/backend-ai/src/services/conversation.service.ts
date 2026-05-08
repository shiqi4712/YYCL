import { prisma } from '../middlewares/prisma'
import { deepseek } from './deepseek.service'
import { buildParentPrompt } from './prompt-engine/parent-role.prompt'
import { buildReviewPrompt } from './prompt-engine/review.prompt'

// In-memory cache for active conversation context (prompt building + state machine)
const sessionCache = new Map<number, {
  scenarioId: number
  status: string
  roundCount: number
}>()

export async function createSession(scenarioId: number, teacherId: number) {
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } })
  if (!scenario) throw { status: 404, message: '场景不存在' }

  const conv = await prisma.conversation.create({
    data: {
      teacherId,
      scenarioId,
      status: 'ACTIVE',
    },
  })

  await prisma.message.create({
    data: {
      conversationId: conv.id,
      role: 'AI',
      content: scenario.initialMessage,
      messageType: 'TEXT',
    },
  })

  sessionCache.set(conv.id, {
    scenarioId,
    status: 'ACTIVE',
    roundCount: 1,
  })

  return {
    sessionId: conv.id,
    initialMessage: scenario.initialMessage,
  }
}

export async function sendMessage(sessionId: number, content: string) {
  let cache = sessionCache.get(sessionId)

  if (!cache) {
    // Restore from database if cache lost (e.g. after service restart)
    const conv = await prisma.conversation.findUnique({
      where: { id: sessionId },
      include: { messages: true },
    })
    if (!conv) throw { status: 404, message: '对话不存在' }
    if (conv.status !== 'ACTIVE') throw { status: 400, message: '对话已结束' }
    cache = {
      scenarioId: conv.scenarioId,
      status: conv.status,
      roundCount: conv.messages.length,
    }
    sessionCache.set(sessionId, cache)
  }

  if (cache.status !== 'ACTIVE') {
    throw { status: 400, message: '对话已结束' }
  }

  // 20-round limit (teacher message count)
  if (cache.roundCount >= 20) {
    cache.status = 'TIMEOUT'
    await prisma.conversation.update({
      where: { id: sessionId },
      data: { status: 'TIMEOUT', endedAt: new Date() },
    })
    throw { status: 400, message: '对话轮次已达上限' }
  }

  // Save teacher message to database
  await prisma.message.create({
    data: {
      conversationId: sessionId,
      role: 'TEACHER',
      content,
      messageType: 'TEXT',
    },
  })
  cache.roundCount++

  // Fetch full conversation with scenario for prompt building
  const conv = await prisma.conversation.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!conv || !conv.scenario) {
    throw { status: 404, message: '对话或场景不存在' }
  }

  const systemPrompt = buildParentPrompt(conv.scenario)
  const chatMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...conv.messages.map((m) => ({
      role: m.role === 'TEACHER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    })),
  ]

  const reply = await deepseek.chat(chatMessages)

  // Save AI reply to database
  await prisma.message.create({
    data: {
      conversationId: sessionId,
      role: 'AI',
      content: reply,
      messageType: 'TEXT',
    },
  })
  cache.roundCount++

  // End detection heuristics
  const lowerReply = reply.toLowerCase()
  let ended = false
  if (
    lowerReply.includes('报名') ||
    lowerReply.includes('交钱') ||
    lowerReply.includes('好的，我') ||
    lowerReply.includes('订了')
  ) {
    cache.status = 'COMPLETED'
    ended = true
  }
  if (
    lowerReply.includes('不考虑') ||
    lowerReply.includes('不需要') ||
    lowerReply.includes('别联系') ||
    lowerReply.includes('挂了')
  ) {
    cache.status = 'FAILED'
    ended = true
  }

  if (ended) {
    await prisma.conversation.update({
      where: { id: sessionId },
      data: { status: cache.status, endedAt: new Date() },
    })
  }

  return {
    role: 'AI',
    content: reply,
    createdAt: new Date().toISOString(),
    status: cache.status,
  }
}

export async function getConversation(sessionId: number) {
  const conv = await prisma.conversation.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      scenario: { select: { id: true, title: true } },
    },
  })
  if (!conv) throw { status: 404, message: '对话不存在' }

  return {
    messages: conv.messages.map((m, idx) => ({
      id: idx + 1,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      messageType: m.messageType,
      createdAt: m.createdAt.toISOString(),
    })),
    status: conv.status,
  }
}

export async function endConversation(sessionId: number) {
  const cache = sessionCache.get(sessionId)
  const targetStatus = cache?.status === 'ACTIVE' ? 'COMPLETED' : cache?.status || 'COMPLETED'

  const conv = await prisma.conversation.update({
    where: { id: sessionId },
    data: {
      status: targetStatus,
      endedAt: new Date(),
    },
  })

  if (cache) {
    cache.status = targetStatus
  }

  return { id: sessionId, status: conv.status }
}

export async function generateReview(sessionId: number) {
  const conv = await prisma.conversation.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!conv) throw { status: 404, message: '对话不存在' }
  if (!conv.scenario) throw { status: 404, message: '场景不存在' }

  const messages = conv.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const promptMessages = [
    { role: 'system' as const, content: '你是一位资深销售培训专家。' },
    {
      role: 'user' as const,
      content: buildReviewPrompt(conv.scenario, messages),
    },
  ]

  const review = await deepseek.chatWithJsonOutput(promptMessages, 0.5)

  // Persist review to database
  await prisma.conversation.update({
    where: { id: sessionId },
    data: {
      finalScore: review.overallScore,
      aiReview: JSON.stringify(review),
      status: conv.status === 'ACTIVE' ? 'COMPLETED' : conv.status,
      endedAt: conv.endedAt || new Date(),
    },
  })

  // Clear in-memory cache
  sessionCache.delete(sessionId)

  return review
}
