import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { requireRole } from '../middlewares/requireRole'
import { createTeacher, listTeachers, updateTeacherStatus } from '../controllers/user.controller'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate)
router.post('/teachers', requireRole('TRAINER'), asyncHandler(createTeacher))
router.get('/teachers', requireRole('TRAINER'), asyncHandler(listTeachers))
router.put('/teachers/:id', requireRole('TRAINER'), asyncHandler(updateTeacherStatus))

export default router