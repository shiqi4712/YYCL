import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import { errorHandler } from './middlewares/errorHandler'
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import scenarioRoutes from './routes/scenario.routes'
import scriptRoutes from './routes/script.routes'
import statsRoutes from './routes/stats.routes'
import conversationRoutes from './routes/conversation.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/scenarios', scenarioRoutes)
app.use('/api/scripts', scriptRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/chat', conversationRoutes)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Backend Core running on http://localhost:${PORT}`)
})
