import type { Request } from 'express'

export type UserRole = 'TRAINER' | 'TEACHER'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  displayName: string | null
}

export interface AuthedRequest extends Request {
  user?: AuthUser
}
