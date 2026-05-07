import type { Request, Response } from 'express'
import * as authService from '../services/auth.service'

export async function login(req: Request, res: Response) {
  const { username, password } = req.body
  const result = await authService.login(username, password)
  res.json({ code: 0, data: result })
}

export async function me(req: Request, res: Response) {
  const user = (req as any).user
  const result = await authService.getUserById(user.id)
  res.json({ code: 0, data: result })
}