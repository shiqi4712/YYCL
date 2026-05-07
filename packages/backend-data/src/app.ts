import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import teacherStatsRoutes from './routes/teacher-stats.routes'
import teamReportRoutes from './routes/team-report.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3003

app.use(cors())
app.use(express.json())

app.use('/api/stats/teacher', teacherStatsRoutes)
app.use('/api/stats/team', teamReportRoutes)

app.listen(PORT, () => {
  console.log(`Backend Data running on http://localhost:${PORT}`)
})