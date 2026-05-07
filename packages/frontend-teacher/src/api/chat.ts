import client from './client'
import type { Conversation, Message, AIReview } from '@yycl/shared'

export function createSession(scenarioId: number) {
  return client.post<{ sessionId: number; initialMessage: string }>('/chat/sessions', { scenarioId })
}

export function sendMessage(sessionId: number, content: string) {
  return client.post<Message>(`/chat/${sessionId}/message`, { content })
}

export function getConversation(sessionId: number) {
  return client.get<{ messages: Message[]; status: string }>(`/chat/${sessionId}`)
}

export function endConversation(sessionId: number) {
  return client.post<Conversation>(`/chat/${sessionId}/end`)
}

export function getReview(conversationId: number) {
  return client.get<AIReview>(`/review/${conversationId}`)
}

export function submitReviewFeedback(reviewId: number, feedback: 'helpful' | 'inaccurate') {
  return client.put(`/review/${reviewId}/feedback`, { feedback })
}
