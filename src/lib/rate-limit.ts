import { NextRequest } from 'next/server'

/**
 * Rate limiting configuration for different endpoint types
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number
  /** Time window in seconds */
  window: number
  /** Identifier for this rate limit (used in error messages) */
  identifier: string
}

/**
 * Rate limit configurations for different endpoint categories
 */
export const RATE_LIMITS = {
  // Strict limits for authentication endpoints
  AUTH: {
    limit: 5,
    window: 60, // 5 requests per minute
    identifier: 'authentication',
  },
  // Moderate limits for write operations (POST, PUT, DELETE)
  WRITE: {
    limit: 30,
    window: 60, // 30 requests per minute
    identifier: 'write operations',
  },
  // More lenient limits for read operations (GET)
  READ: {
    limit: 100,
    window: 60, // 100 requests per minute
    identifier: 'read operations',
  },
  // Very strict limits for expensive operations (AI, file uploads)
  EXPENSIVE: {
    limit: 10,
    window: 60, // 10 requests per minute
    identifier: 'expensive operations',
  },
  // Default fallback
  DEFAULT: {
    limit: 60,
    window: 60, // 60 requests per minute
    identifier: 'API',
  },
} as const

/**
 * In-memory rate limit store
 * Note: For production with multiple instances, use Redis or Upstash
 */
interface RateLimitRecord {
  count: number
  resetAt: number
}

class RateLimitStore {
  private store = new Map<string, RateLimitRecord>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.store.entries())
    for (const [key, record] of entries) {
      if (now > record.resetAt) {
        this.store.delete(key)
      }
    }
  }

  get(key: string): RateLimitRecord | undefined {
    const record = this.store.get(key)
    if (record && Date.now() > record.resetAt) {
      this.store.delete(key)
      return undefined
    }
    return record
  }

  set(key: string, record: RateLimitRecord): void {
    this.store.set(key, record)
  }

  increment(key: string): void {
    const record = this.store.get(key)
    if (record) {
      record.count++
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// Global rate limit store instance
const rateLimitStore = new RateLimitStore()

/**
 * Get IP address from request headers
 */
export function getClientIp(request: NextRequest): string {
  // Try to get IP address from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare
  
  if (cfConnectingIp) {
    return cfConnectingIp.split(',')[0].trim()
  }
  if (realIp) {
    return realIp.split(',')[0].trim()
  }
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return 'unknown'
}

/**
 * Get client identifier for rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP address
 */
export function getRateLimitKey(request: NextRequest, userId?: string | null, endpoint?: string): string {
  const ipAddress = getClientIp(request)
  
  // Use user ID if available (more accurate for authenticated users)
  // Otherwise use IP address
  const identifier = userId || ipAddress
  
  // Include endpoint in key for per-endpoint rate limiting
  const key = endpoint 
    ? `ratelimit:${identifier}:${endpoint}`
    : `ratelimit:${identifier}`
  
  return key
}

/**
 * Determine which rate limit config to use based on the request
 */
export function getRateLimitConfig(
  method: string,
  pathname: string
): RateLimitConfig {
  // Authentication endpoints - very strict
  if (pathname.startsWith('/api/auth') || pathname.includes('/login') || pathname.includes('/signin')) {
    return RATE_LIMITS.AUTH
  }

  // Expensive operations - strict limits
  if (
    pathname.includes('/ai/') ||
    pathname.includes('/upload') ||
    pathname.includes('/media/') ||
    pathname.includes('/generate')
  ) {
    return RATE_LIMITS.EXPENSIVE
  }

  // Write operations (POST, PUT, DELETE, PATCH)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return RATE_LIMITS.WRITE
  }

  // Read operations (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return RATE_LIMITS.READ
  }

  // Default fallback
  return RATE_LIMITS.DEFAULT
}

/**
 * Check if a request should be rate limited
 * @returns Object with allowed status, remaining requests, and reset time
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
} {
  const now = Date.now()
  const windowMs = config.window * 1000
  const record = rateLimitStore.get(key)

  // No record or expired - create new one
  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: Math.floor(resetAt / 1000), // Return as Unix timestamp in seconds
      limit: config.limit,
    }
  }

  // Check if limit exceeded
  if (record.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: Math.floor(record.resetAt / 1000),
      limit: config.limit,
    }
  }

  // Increment count
  rateLimitStore.increment(key)

  return {
    allowed: true,
    remaining: config.limit - record.count - 1,
    resetAt: Math.floor(record.resetAt / 1000),
    limit: config.limit,
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: {
  remaining: number
  resetAt: number
  limit: number
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': result.resetAt.toString(),
    'Retry-After': result.resetAt.toString(),
  }
}
