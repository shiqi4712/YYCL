import './env'

import express from 'express'
import cors from 'cors'

import chatRoutes from './routes/chat.routes'
import reviewRoutes from './routes/review.routes'

const app = express()
const PORT = process.env.PORT || 3002

app.use(cors())
app.use(express.json())

app.use('/api/chat', chatRoutes)
app.use('/api/review', reviewRoutes)

app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err)
  const status = err.status || err.response?.status || 500
  const message = err.message || 'Internal Server Error'
  res.status(status).json({ code: status, message })
})

app.listen(PORT, () => {
  console.log(`Backend AI running on http://localhost:${PORT}`)
})
