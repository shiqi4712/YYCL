import axios from 'axios'

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class DeepSeekService {
  private client = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 30000
  })

  async chat(messages: ChatMessage[], temperature = 0.8): Promise<string> {
    const res = await this.client.post('/chat/completions', {
      model: MODEL,
      messages,
      temperature,
      max_tokens: 2048
    })
    return res.data.choices[0].message.content
  }

  async chatWithJsonOutput(messages: ChatMessage[], temperature = 0.5): Promise<any> {
    const res = await this.client.post('/chat/completions', {
      model: MODEL,
      messages,
      temperature,
      max_tokens: 2048,
      response_format: { type: 'json_object' }
    })
    const content = res.data.choices[0].message.content
    return JSON.parse(content)
  }
}

export const deepseek = new DeepSeekService()
