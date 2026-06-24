import './env'

import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { env } from './env'
import { enableSqlitePragmas } from './lib/prisma'
import { errorHandler } from './middleware/error'
import adminRoutes from './routes/admin'
import authRoutes from './routes/auth'
import topicRoutes from './routes/topics'
import trainingRoutes from './routes/training'
import { ok } from './utils/api'

const app = express()
const teacherAppDir = path.resolve(__dirname, '../../web-teacher')
const adminAppDir = path.resolve(__dirname, '../../web-admin')

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json(ok({ status: 'ok', service: env.appName }))
})

app.use('/api/admin', adminRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/topics', topicRoutes)
app.use('/api/training', trainingRoutes)

app.use('/assets/admin', express.static(path.join(adminAppDir, 'assets')))
app.use('/assets/teacher', express.static(path.join(teacherAppDir, 'assets')))
app.use('/admin', express.static(adminAppDir))
app.use('/', express.static(teacherAppDir))

app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(adminAppDir, 'index.html'))
})

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next()
    return
  }

  res.sendFile(path.join(teacherAppDir, 'index.html'))
})

app.use(errorHandler)

enableSqlitePragmas()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`${env.appName} listening on http://localhost:${env.port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to initialize database pragmas', error)
    process.exit(1)
  })
