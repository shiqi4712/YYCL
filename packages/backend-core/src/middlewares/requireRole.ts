import type { Response, NextFunction } from 'express'
import type { AuthRequest } from './auth'

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: 'Forbidden' })
    }
    next()
  }
}
