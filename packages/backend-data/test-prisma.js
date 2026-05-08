require('dotenv').config({ override: true, path: './.env' });
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.conversation.count()
  .then(c => console.log('count:', c))
  .catch(e => console.error('error:', e.message))
  .finally(() => prisma.$disconnect());
