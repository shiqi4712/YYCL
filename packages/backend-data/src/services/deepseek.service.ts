import axios from 'axios'

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

export async function deepseekChatJson(
  messages: { role: string; content: string }[],
  temperature = 0.5
): Promise<any> {
  const res = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: MODEL,
      messages,
      temperature,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  )
  const content = res.data.choices[0].message.content
  return JSON.parse(content)
}
