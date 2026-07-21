import path from 'node:path'

const prismaModulePath = path.join(process.cwd(), 'src', 'generated', 'prisma')
// Load the generated client from the workspace path so both tsx(dev) and node(dist) work.
const { PrismaClient } = require(prismaModulePath) as any

const globalForPrisma = globalThis as unknown as { prisma?: any }

export const prisma: any =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}

export async function initializeDatabase() {
  try {
    await prisma.$connect()
  } catch (error) {
    console.error('Database connection failed:', error)
    throw error
  }
}
