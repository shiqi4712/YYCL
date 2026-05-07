import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { requireRole } from '../middlewares/requireRole'
import { createTeacher, listTeachers, updateTeacherStatus } from '../controllers/user.controller'

const router = Router()

router.use(authenticate)
router.post('/teachers', requireRole('TRAINER'), createTeacher)
router.get('/teachers', requireRole('TRAINER'), listTeachers)
router.put('/teachers/:id', requireRole('TRAINER'), updateTeacherStatus)

export default router