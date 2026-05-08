require('dotenv').config({ override: true, path: './.env' })
process.env.DATABASE_URL = 'file:./dev.db'
console.log('DATABASE_URL:', process.env.DATABASE_URL)

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.conversation.count()
  .then(c => { console.log('count:', c); process.exit(0) })
  .catch(e => { console.error('error:', e.message); process.exit(1) })
