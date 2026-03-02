import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { normalizePgConnectionString } from './postgres-connection-string'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = normalizePgConnectionString(process.env.DATABASE_URL)
const adapter =
  typeof window === 'undefined'
    ? new PrismaPg({ connectionString })
    : undefined

const prismaClient =
  globalForPrisma.prisma ??
  (adapter
    ? new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      } as unknown as ConstructorParameters<typeof PrismaClient>[0])
    : new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      }))

export const prisma: PrismaClient = prismaClient

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient
}
