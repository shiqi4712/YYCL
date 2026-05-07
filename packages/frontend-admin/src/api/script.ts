import client from './client'

export function getScripts(params?: any) {
  return client.get('/scripts', { params })
}

export function createScript(data: any) {
  return client.post('/scripts', data)
}

export function updateScript(id: number, data: any) {
  return client.put(`/scripts/${id}`, data)
}

export function deleteScript(id: number) {
  return client.delete(`/scripts/${id}`)
}

export function updateScriptStatus(id: number, status: string) {
  return client.patch(`/scripts/${id}/status`, { status })
}
