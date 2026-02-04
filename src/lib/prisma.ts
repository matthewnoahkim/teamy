import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Conditionally import adapter if available
// Using a function to prevent webpack from trying to bundle this at build time
function getAdapter() {
  if (typeof window !== 'undefined') return undefined // Client-side, no adapter needed
  
  try {
    // Dynamic import that webpack won't try to bundle
    const adapterModule = require('@prisma/adapter-pg')
    const PrismaPg = adapterModule?.PrismaPg
    const connectionString = process.env.DATABASE_URL
    if (connectionString && PrismaPg) {
      return new PrismaPg({ connectionString })
    }
  } catch {
    // Adapter not available, will use default
  }
  return undefined
}

const adapter = getAdapter()

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
