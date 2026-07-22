import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../utils/http-error'

const fieldLabels: Record<string, string> = {
  title: '异议问题',
  concern: '家长真实顾虑',
  thinking: '解决思路',
  scripts: '推荐话术',
  avoid: '禁忌提醒',
  username: '账号',
  password: '密码',
  displayName: '姓名',
}

function formatZodError(error: ZodError) {
  const messages = error.issues.map((issue) => {
    const field = String(issue.path[0] || '')
    const label = fieldLabels[field] || field || '内容'

    if (issue.code === 'too_small') {
      return `请填写${label}`
    }

    if (issue.code === 'invalid_type') {
      return `${label}格式不正确`
    }

    return `${label}：${issue.message}`
  })

  return [...new Set(messages)].join('；')
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)

  if (err instanceof HttpError) {
    return res.status(err.status).json({ code: err.status, message: err.message })
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ code: 400, message: formatZodError(err) })
  }

  if (err instanceof Error) {
    return res.status(500).json({ code: 500, message: err.message })
  }

  return res.status(500).json({ code: 500, message: 'Internal Server Error' })
}
