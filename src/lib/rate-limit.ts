import { NextRequest } from 'next/server'

const TRUST_X_FORWARDED_FOR = process.env.RATE_LIMIT_TRUST_X_FORWARDED_FOR === 'true'
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '')
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const HAS_DISTRIBUTED_RATE_LIMIT =
  typeof UPSTASH_REDIS_REST_URL === 'string' &&
  UPSTASH_REDIS_REST_URL.length > 0 &&
  typeof UPSTASH_REDIS_REST_TOKEN === 'string' &&
  UPSTASH_REDIS_REST_TOKEN.length > 0

const IPV4_SEGMENT = '(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)'
const IPV4_REGEX = new RegExp(`^${IPV4_SEGMENT}\\.${IPV4_SEGMENT}\\.${IPV4_SEGMENT}\\.${IPV4_SEGMENT}$`)
const IPV6_REGEX = /^[0-9a-fA-F:]+$/

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

export interface RateLimitCheckResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

class RateLimitStore {
  private store = new Map<string, RateLimitRecord>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
    this.cleanupInterval.unref?.()
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

function hashString(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24)
  }
  return (hash >>> 0).toString(16)
}

function normalizeIpCandidate(value: string): string | null {
  let candidate = value.trim()
  if (!candidate) return null

  // Strip surrounding brackets for IPv6 literals.
  if (candidate.startsWith('[') && candidate.endsWith(']')) {
    candidate = candidate.slice(1, -1)
  }

  // Strip :port for IPv4 values.
  if (candidate.includes('.') && candidate.includes(':') && candidate.indexOf(':') === candidate.lastIndexOf(':')) {
    candidate = candidate.split(':')[0]
  }

  if (IPV4_REGEX.test(candidate)) return candidate
  if (
    candidate.includes(':') &&
    candidate.length <= 45 &&
    IPV6_REGEX.test(candidate)
  ) {
    return candidate.toLowerCase()
  }

  return null
}

function extractFirstIp(value: string | null): string | null {
  if (!value) return null

  const parts = value
    .split(',')
    .map((part) => normalizeIpCandidate(part))
    .filter((part): part is string => !!part)

  return parts[0] ?? null
}

type UpstashPipelineResult = {
  result?: unknown
  error?: unknown
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed)
    }
  }
  return null
}

async function runUpstashPipeline(
  commands: Array<Array<string | number>>
): Promise<UpstashPipelineResult[]> {
  if (!HAS_DISTRIBUTED_RATE_LIMIT || !UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Distributed rate limiting is not configured')
  }

  const response = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Upstash pipeline failed with status ${response.status}`)
  }

  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload)) {
    throw new Error('Invalid Upstash pipeline response')
  }

  return payload as UpstashPipelineResult[]
}

async function checkDistributedRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitCheckResult> {
  const windowSeconds = Math.max(1, Math.floor(config.window))

  const responses = await runUpstashPipeline([
    ['INCR', key],
    ['EXPIRE', key, windowSeconds, 'NX'],
    ['TTL', key],
  ])

  const count = parseNumber(responses[0]?.result)
  const ttl = parseNumber(responses[2]?.result)

  if (!count || count < 1) {
    throw new Error('Distributed rate limiter returned invalid count')
  }

  const effectiveTtl = ttl && ttl > 0 ? ttl : windowSeconds
  const resetAt = Math.floor(Date.now() / 1000) + effectiveTtl

  if (count > config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      limit: config.limit,
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.limit - count),
    resetAt,
    limit: config.limit,
  }
}

/**
 * Get IP address from request headers
 */
export function getClientIp(request: NextRequest): string {
  // Prefer platform headers that are typically managed by the hosting edge.
  const cfConnectingIp = extractFirstIp(request.headers.get('cf-connecting-ip'))
  if (cfConnectingIp) return cfConnectingIp

  const vercelForwardedFor = extractFirstIp(request.headers.get('x-vercel-forwarded-for'))
  if (vercelForwardedFor) return vercelForwardedFor

  const realIp = extractFirstIp(request.headers.get('x-real-ip'))
  if (realIp) return realIp

  if (TRUST_X_FORWARDED_FOR) {
    const forwarded = extractFirstIp(request.headers.get('x-forwarded-for'))
    if (forwarded) return forwarded
  }

  return 'unknown'
}

/**
 * Get client identifier for rate limiting
 * Uses user ID if authenticated, otherwise falls back to IP address
 */
export function getRateLimitKey(request: NextRequest, userId?: string | null, endpoint?: string): string {
  const ipAddress = getClientIp(request)

  // Prefer authenticated user IDs. For anonymous traffic, fall back to an IP
  // and then a lightweight user-agent hash when IP metadata is unavailable.
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const anonymousIdentifier =
    ipAddress !== 'unknown'
      ? `ip:${ipAddress}`
      : `ua:${hashString(userAgent)}`
  const identifier = userId || anonymousIdentifier
  
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

  // Dev/admin endpoints - strict limits, no wildcard CORS
  if (pathname.startsWith('/api/dev')) {
    return { limit: 30, window: 60, identifier: 'dev API' }
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
): RateLimitCheckResult {
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
 * Check if a request should be rate limited
 * Uses Upstash Redis when configured, with in-memory fallback.
 */
export async function checkRateLimitWithFallback(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitCheckResult> {
  if (HAS_DISTRIBUTED_RATE_LIMIT) {
    try {
      return await checkDistributedRateLimit(key, config)
    } catch (error) {
      console.error('Distributed rate limiter failed, falling back to in-memory store:', error)
    }
  }

  return checkRateLimit(key, config)
}

/**
 * Check if a request should be rate limited
 * @returns Object with allowed status, remaining requests, and reset time
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitCheckResult> {
  return checkRateLimitWithFallback(key, config)
}

/**
 * @deprecated Use checkRateLimitAsync for new code paths.
 */
export function checkRateLimitSync(
  key: string,
  config: RateLimitConfig
): RateLimitCheckResult {
  return checkRateLimit(key, config)
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: {
  remaining: number
  resetAt: number
  limit: number
}): Record<string, string> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const retryAfterSeconds = Math.max(0, result.resetAt - nowSeconds)

  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': result.resetAt.toString(),
    'Retry-After': retryAfterSeconds.toString(),
  }
}
