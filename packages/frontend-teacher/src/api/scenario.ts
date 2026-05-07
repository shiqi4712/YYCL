import client from './client'
import type { Scenario } from '@yycl/shared'

export function getScenarios(params?: { category?: string; difficulty?: string }) {
  return client.get<Scenario[]>('/scenarios', { params })
}

export function getScenario(id: number) {
  return client.get<Scenario>(`/scenarios/${id}`)
}
