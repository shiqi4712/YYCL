import client from './client'
import type { Script } from '@yycl/shared'

export function getScripts(params?: { category?: string; keyword?: string }) {
  return client.get<Script[]>('/scripts', { params })
}

export function favoriteScript(id: number) {
  return client.post(`/scripts/${id}/favorite`)
}

export function unfavoriteScript(id: number) {
  return client.delete(`/scripts/${id}/favorite`)
}

export function getFavorites() {
  return client.get<Script[]>('/scripts/favorites')
}
