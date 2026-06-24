import { existsSync } from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../prisma/.env'),
]

for (const file of envCandidates) {
  if (existsSync(file)) {
    dotenv.config({ path: file })
  }
}

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 3101),
  jwtSecret: required('JWT_SECRET', 'yycl-v2-dev-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  appName: process.env.APP_NAME ?? 'YYCL V2 API',
  aiProvider: process.env.AI_PROVIDER ?? 'mock',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
  deepseekThinking: process.env.DEEPSEEK_THINKING ?? 'disabled',
}
