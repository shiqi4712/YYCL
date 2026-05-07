import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import chatRoutes from './routes/chat.routes'
import reviewRoutes from './routes/review.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002

app.use(cors())
app.use(express.json())

app.use('/api/chat', chatRoutes)
app.use('/api/review', reviewRoutes)

app.listen(PORT, () => {
  console.log(`Backend AI running on http://localhost:${PORT}`)
})
