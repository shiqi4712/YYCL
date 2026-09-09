import { Router, type Response } from 'express'
import { authenticate } from '../middleware/auth'
import type { AuthedRequest } from '../types'
import { login } from '../services/auth.service'
import {
  beginInternalLogin,
  completeInternalLogin,
  readInternalCallback,
} from '../services/internal-auth.service'
import { getCurrentUserProfile } from '../services/admin.service'
import {
  clearLoginStateCookie,
  clearSessionCookie,
  loginStateCookieName,
  readCookie,
  safeTokenEqual,
  setLoginStateCookie,
  setSessionCookie,
} from '../lib/site-session'
import { prisma } from '../lib/prisma'
import { ok } from '../utils/api'
import { HttpError } from '../utils/http-error'

const router = Router()

function sendLoginError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : '内部账号登录失败，请重新登录'
  const entityMap: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }
  const escaped = message.replace(/[&<>"']/g, (char) => entityMap[char])
  res.status(error instanceof HttpError ? error.status : 400).send(
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>登录失败</title><body><main><h1>登录未完成</h1><p>${escaped}</p><a href="/">返回并重新登录</a></main></body></html>`
  )
}

router.post('/login', async (req, res, next) => {
  try {
    res.json(ok(await login(req.body)))
  } catch (error) {
    next(error)
  }
})

router.get('/internal/start', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store')
    const login = await beginInternalLogin(req.query.returnTo)
    setLoginStateCookie(res, login.state)
    res.redirect(login.url)
  } catch (error) {
    sendLoginError(res, error)
  }
})

router.get('/internal/callback', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store')
    const callback = readInternalCallback(req.query as Record<string, unknown>)
    const browserState = readCookie(req, loginStateCookieName)
    if (!browserState || !safeTokenEqual(browserState, callback.state)) {
      throw new HttpError(400, '登录请求与当前浏览器不匹配，请重新登录')
    }
    const result = await completeInternalLogin(callback.code, callback.state)
    clearLoginStateCookie(res)
    setSessionCookie(res, result.session.id)
    res.redirect(result.returnTo)
  } catch (error) {
    clearLoginStateCookie(res)
    sendLoginError(res, error)
  }
})

router.get('/internal/session', authenticate, async (req: AuthedRequest, res) => {
  if (req.authMethod !== 'SESSION') {
    return res.status(401).json({ code: 401, message: 'Unauthorized' })
  }
  res.set('Cache-Control', 'no-store')
  res.json(ok({
    user: {
      id: req.user!.id,
      displayName: req.user!.displayName,
      role: req.user!.role,
    },
    csrfToken: req.csrfToken,
  }))
})

router.post('/logout', authenticate, async (req: AuthedRequest, res, next) => {
  try {
    if (req.authSessionId) {
      await prisma.authSession.deleteMany({ where: { id: req.authSessionId } })
    }
    clearSessionCookie(res)
    res.json(ok({ loggedOut: true }))
  } catch (error) {
    next(error)
  }
})

router.get('/me', authenticate, async (req: AuthedRequest, res, next) => {
  try {
    res.json(ok(await getCurrentUserProfile(req.user!.id)))
  } catch (error) {
    next(error)
  }
})

export default router
