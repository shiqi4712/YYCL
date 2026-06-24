import type { NextFunction, Response } from 'express'
import type { AuthedRequest, UserRole } from '../types'

export function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: 'Forbidden' })
    }

    next()
  }
}
