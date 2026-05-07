import type { Request, Response } from 'express'
import * as userService from '../services/user.service'

export async function createTeacher(req: Request, res: Response) {
  const trainerId = (req as any).user.id
  const result = await userService.createTeacher(req.body, trainerId)
  res.json({ code: 0, data: result })
}

export async function listTeachers(req: Request, res: Response) {
  const result = await userService.listTeachers()
  res.json({ code: 0, data: result })
}

export async function updateTeacherStatus(req: Request, res: Response) {
  const id = Number(req.params.id)
  const result = await userService.updateTeacherStatus(id, req.body.status)
  res.json({ code: 0, data: result })
}