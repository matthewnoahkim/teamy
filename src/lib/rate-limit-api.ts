import { NextRequest, NextResponse } from 'next/server'
import {
  getRateLimitKey,
  getRateLimitConfig,
  checkRateLimit,
  getRateLimitHeaders,
  RATE_LIMITS,
  type RateLimitConfig,
} from '@/lib/rate-limit'

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

/**
 * Rate limit a request in an API route handler
 * Use this for more granular control than middleware
 * 
 * @example
 * ```typescript
 * const rateLimitResult = await rateLimitRequest(request, session?.user?.id)
 * if (!rateLimitResult.allowed) {
 *   return NextResponse.json(
 *     { error: 'Too many requests' },
 *     { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
 *   )
 * }
 * ```
 */
export async function rateLimitRequest(
  request: NextRequest,
  userId?: string | null,
  customConfig?: RateLimitConfig,
  endpoint?: string
): Promise<RateLimitResult> {
  const config = customConfig || getRateLimitConfig(request.method, request.nextUrl.pathname)
  const key = getRateLimitKey(request, userId, endpoint)
  
  return checkRateLimit(key, config)
}

/**
 * Create a rate-limited response helper
 * Returns a 429 response if rate limited, or null if allowed
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  config: RateLimitConfig
): NextResponse | null {
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${config.identifier}. Please try again later.`,
        retryAfter: result.resetAt,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(result),
      }
    )
  }
  
  return null
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 * 
 * @example
 * ```typescript
 * export const GET = withRateLimit(
 *   async (request: NextRequest) => {
 *     // Your handler code
 *   },
 *   RATE_LIMITS.READ
 * )
 * ```
 */
export function withRateLimit<T extends NextRequest>(
  handler: (request: T, ...args: any[]) => Promise<NextResponse>,
  config?: RateLimitConfig,
  getUserId?: (request: T) => string | null | undefined
) {
  return async (request: T, ...args: any[]): Promise<NextResponse> => {
    const userId = getUserId ? getUserId(request) : undefined
    const rateLimitConfig = config || getRateLimitConfig(request.method, request.nextUrl.pathname)
    const result = await rateLimitRequest(request, userId, rateLimitConfig)
    
    const rateLimitResponse = createRateLimitResponse(result, rateLimitConfig)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    
    // Call the original handler
    const response = await handler(request, ...args)
    
    // Add rate limit headers to response
    const headers = getRateLimitHeaders(result)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, String(value))
    })
    
    return response
  }
}

/**
 * Export rate limit configs for use in API routes
 */
export { RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit'
