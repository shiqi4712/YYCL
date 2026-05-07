import client from './client'

export function getScenarios(params?: any) {
  return client.get('/scenarios', { params })
}

export function createScenario(data: any) {
  return client.post('/scenarios', data)
}

export function updateScenario(id: number, data: any) {
  return client.put(`/scenarios/${id}`, data)
}

export function deleteScenario(id: number) {
  return client.delete(`/scenarios/${id}`)
}

export function updateScenarioStatus(id: number, status: string) {
  return client.patch(`/scenarios/${id}/status`, { status })
}
