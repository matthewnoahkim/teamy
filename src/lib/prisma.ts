import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Conditionally import adapter if available
let PrismaPg: any = null
try {
  PrismaPg = require('@prisma/adapter-pg').PrismaPg
} catch {
  // Adapter not available, will use default
}

const connectionString = process.env.DATABASE_URL
const adapter = connectionString && PrismaPg ? new PrismaPg({ connectionString }) : undefined

const prismaClient =
  globalForPrisma.prisma ??
  (adapter
    ? new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      } as any)
    : new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      }))

export const prisma: PrismaClient = prismaClient

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient
}
