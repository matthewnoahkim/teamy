// API logging and rate limiting middleware

import { NextRequest, NextResponse } from 'next/server'
import {
  getRateLimitKey,
  getRateLimitConfig,
  checkRateLimit,
  getRateLimitHeaders,
} from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip rate limiting for certain paths
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/static',
    '/api/auth/callback', // OAuth callbacks need to work
    '/api/auth/session', // Session checks are frequent
  ]
  
  if (skipPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  try {
    // Get rate limit configuration based on method and path
    const config = getRateLimitConfig(request.method, pathname)
    
    // Use IP-based limiting in middleware (user-based limiting can be added in individual routes)
    // This provides protection against DDoS attacks even for unauthenticated requests
    const rateLimitKey = getRateLimitKey(request, null, pathname)
    
    // Check rate limit
    const result = checkRateLimit(rateLimitKey, config)

    // If rate limited, return 429 Too Many Requests
    if (!result.allowed) {
      const headers = getRateLimitHeaders(result)
      
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded for ${config.identifier}. Please try again later.`,
          retryAfter: result.resetAt,
        },
        {
          status: 429,
          headers,
        }
      )
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next()
    const rateLimitHeaders = getRateLimitHeaders(result)
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, String(value))
    })

    return response
  } catch (error) {
    // If rate limiting fails, allow the request through (fail open)
    // Log the error but don't block legitimate traffic
    console.error('Rate limiting error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
