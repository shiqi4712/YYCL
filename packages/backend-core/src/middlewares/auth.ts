import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: { id: number; username: string; role: string }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: 'Unauthorized' })
  }
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ code: 401, message: 'Invalid token' })
  }
}
