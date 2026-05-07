import client from './client'
import type { Conversation, TeacherStats } from '@yycl/shared'

export function getHistory(params?: { page?: number; pageSize?: number }) {
  return client.get<{ list: Conversation[]; total: number }>('/stats/teacher/history', { params })
}

export function getOverview() {
  return client.get<TeacherStats>('/stats/teacher/overview')
}

export function getTrend() {
  return client.get<{ date: string; score: number }[]>('/stats/teacher/trend')
}

export function getRadar() {
  return client.get<Record<string, number>>('/stats/teacher/radar')
}
