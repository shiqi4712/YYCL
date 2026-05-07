import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => {
    if (res.data.code !== 0 && res.data.code !== 200) {
      ElMessage.error(res.data.message || '请求失败')
      return Promise.reject(res.data)
    }
    return res.data.data
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      router.push('/login')
    }
    ElMessage.error(err.response?.data?.message || '网络错误')
    return Promise.reject(err)
  }
)

export default client
