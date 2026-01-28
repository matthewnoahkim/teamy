import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL
const adapter = connectionString ? new PrismaPg({ connectionString }) : undefined

const prismaClient =
  globalForPrisma.prisma ??
  (adapter
    ? new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      })
    : null)

export const prisma: PrismaClient =
  prismaClient ??
  new Proxy({} as PrismaClient, {
    get() {
      throw new Error('Prisma is not configured. Set DATABASE_URL to enable database access.')
    },
  })

if (process.env.NODE_ENV !== 'production' && prismaClient) {
  globalForPrisma.prisma = prismaClient
}
