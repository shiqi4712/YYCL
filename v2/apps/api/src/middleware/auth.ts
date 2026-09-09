import type { NextFunction, Response } from 'express'
import { verifyToken } from '../lib/auth'
import { prisma } from '../lib/prisma'
import type { AuthedRequest, UserRole } from '../types'

export async function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: 'Unauthorized' })
  }

  try {
    const tokenUser = verifyToken(header.slice(7))
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.id },
      select: {
        id: true,
        username: true,
        role: true,
        displayName: true,
        teamId: true,
        isSuperAdmin: true,
        isActive: true,
        team: { select: { name: true, isActive: true } },
      },
    })
    if (!user?.isActive || (user.team && !user.team.isActive)) {
      return res.status(401).json({ code: 401, message: '账号已停用或删除' })
    }
    req.user = {
      ...user,
      role: user.role as UserRole,
      teamName: user.team?.name ?? null,
      isSuperAdmin: user.isSuperAdmin || user.username === 'shiqi',
    }
    next()
  } catch {
    return res.status(401).json({ code: 401, message: 'Invalid token' })
  }
}
