const path = require('path')
const dbPath = path.resolve(__dirname, '../backend-core/prisma/dev.db')
console.log('Absolute DB path:', dbPath)

require('dotenv').config({ override: true })
process.env.DATABASE_URL = 'file:' + dbPath

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.conversation.count()
  .then(c => { console.log('count:', c); process.exit(0) })
  .catch(e => { console.error('error:', e.message); process.exit(1) })
