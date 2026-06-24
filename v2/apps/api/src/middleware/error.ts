import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../utils/http-error'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)

  if (err instanceof HttpError) {
    return res.status(err.status).json({ code: err.status, message: err.message })
  }

  if (err instanceof Error) {
    return res.status(500).json({ code: 500, message: err.message })
  }

  return res.status(500).json({ code: 500, message: 'Internal Server Error' })
}
