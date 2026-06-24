import type { NextFunction, Response } from 'express'
import { verifyToken } from '../lib/auth'
import type { AuthedRequest } from '../types'

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: 'Unauthorized' })
  }

  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    return res.status(401).json({ code: 401, message: 'Invalid token' })
  }
}
