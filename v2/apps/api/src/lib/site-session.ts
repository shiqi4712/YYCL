import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { env } from '../env'
import { prisma } from './prisma'

export const sessionCookieName = 'yycl_session'
export const loginStateCookieName = 'yycl_login_state'

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('hex')
}

export function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function safeTokenEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function readCookie(req: Request, name: string) {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return ''

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const key = part.slice(0, separator).trim()
    if (key === name) {
      const value = part.slice(separator + 1).trim()
      try {
        return decodeURIComponent(value)
      } catch {
        return ''
      }
    }
  }
  return ''
}

function cookieSecure() {
  return env.publicUrl.startsWith('https://') || process.env.NODE_ENV === 'production'
}

export function setSessionCookie(res: Response, sessionId: string) {
  res.cookie(sessionCookieName, sessionId, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: env.authSessionHours * 60 * 60 * 1000,
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/',
  })
}

export function setLoginStateCookie(res: Response, state: string) {
  res.cookie(loginStateCookieName, state, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/api/auth/internal',
    maxAge: 10 * 60 * 1000,
  })
}

export function clearLoginStateCookie(res: Response) {
  res.clearCookie(loginStateCookieName, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    path: '/api/auth/internal',
  })
}

export async function createSiteSession(userId: string) {
  const id = randomToken()
  const csrfToken = randomToken()
  const expiresAt = new Date(Date.now() + env.authSessionHours * 60 * 60 * 1000)

  await prisma.authSession.create({
    data: { id, userId, csrfToken, expiresAt },
  })
  await prisma.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } })

  return { id, csrfToken, expiresAt }
}
