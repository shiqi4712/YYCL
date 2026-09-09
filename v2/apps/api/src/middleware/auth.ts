import type { NextFunction, Response } from 'express'
import { verifyToken } from '../lib/auth'
import { prisma } from '../lib/prisma'
import { readCookie, safeTokenEqual, sessionCookieName } from '../lib/site-session'
import type { AuthedRequest, UserRole } from '../types'

export async function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    let tokenUser
    try {
      tokenUser = verifyToken(header.slice(7))
    } catch {
      return res.status(401).json({ code: 401, message: 'Invalid token' })
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: tokenUser.id },
        select: { id: true, username: true, role: true, displayName: true, isActive: true },
      })
      if (!user?.isActive) {
        return res.status(401).json({ code: 401, message: '账号已停用或删除' })
      }
      req.user = {
        ...user,
        role: user.role as UserRole,
      }
      req.authMethod = 'JWT'
      return next()
    } catch (error) {
      return next(error)
    }
  }

  try {
    const sessionId = readCookie(req, sessionCookieName)
    if (sessionId) {
      const session = await prisma.authSession.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            select: { id: true, username: true, role: true, displayName: true, isActive: true },
          },
        },
      })

      if (session && session.expiresAt > new Date() && session.user.isActive) {
        const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
        const csrfToken = String(req.headers['x-csrf-token'] || '')
        if (isWrite && !safeTokenEqual(csrfToken, session.csrfToken)) {
          return res.status(403).json({ code: 403, message: '页面校验已过期，请刷新后重试' })
        }

        req.user = {
          ...session.user,
          role: session.user.role as UserRole,
        }
        req.authMethod = 'SESSION'
        req.authSessionId = session.id
        req.csrfToken = session.csrfToken
        return next()
      }

      await prisma.authSession.deleteMany({ where: { id: sessionId } })
    }

  } catch (error) {
    return next(error)
  }

  return res.status(401).json({ code: 401, message: 'Unauthorized' })
}
