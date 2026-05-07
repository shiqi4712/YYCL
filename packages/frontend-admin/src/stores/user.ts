import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@yycl/shared'
import client from '@/api/client'

export const useUserStore = defineStore('adminUser', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => !!token.value)

  async function login(username: string, password: string) {
    const res = await client.post('/auth/login', { username, password })
    token.value = res.token
    localStorage.setItem('admin_token', res.token)
    await fetchMe()
    return res
  }

  async function fetchMe() {
    const res = await client.get('/auth/me')
    user.value = res
    return res
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('admin_token')
  }

  return { token, user, isLoggedIn, login, fetchMe, logout }
})
