// API logging, rate limiting, and security middleware

import { NextRequest, NextResponse } from 'next/server'
import {
  getRateLimitKey,
  getRateLimitConfig,
  checkRateLimit,
  getRateLimitHeaders,
} from '@/lib/rate-limit'
import { getSecurityHeaders } from '@/lib/security-config'
import { shouldRejectPotentialCsrf } from '@/lib/csrf-guard'
import { getConfiguredAppOrigins } from '@/lib/url-safety'

function normalizeOriginCandidate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const withProtocol =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`

  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.origin
  } catch {
    return null
  }
}

export function getAllowedOriginsForRequest(request: NextRequest): string[] {
  const origins = new Set(getConfiguredAppOrigins())
  const addOrigin = (value: string | null | undefined) => {
    if (!value) return
    const normalized = normalizeOriginCandidate(value)
    if (normalized) {
      origins.add(normalized)
    }
  }

  // Always trust the current deployment origin so authenticated same-site
  // mutations work across production/custom/preview hosts.
  addOrigin(request.nextUrl.origin)

  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedProto && forwardedHost) {
    addOrigin(`${forwardedProto}://${forwardedHost}`)
  }

  return [...origins]
}

/**
 * Middleware for API protection and security hardening
 * 
 * SECURITY FEATURES:
 * 1. Rate limiting (IP + user-based)
 * 2. Security headers (OWASP best practices)
 * 3. CORS protection
 * 4. Request validation
 */

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const securityHeaders = getSecurityHeaders()

  const applySecurityHeaders = (response: NextResponse): NextResponse => {
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    return response
  }

  // Skip rate limiting for certain paths
  const skipPaths = [
    '/_next',
    '/favicon.ico',
    '/static',
    '/api/auth/callback', // OAuth callbacks need to work
    '/api/auth/session', // Session checks are frequent
  ]

  if (skipPaths.some(path => pathname.startsWith(path))) {
    return applySecurityHeaders(NextResponse.next())
  }

  // Apply security headers to all non-API routes without rate limiting.
  if (!pathname.startsWith('/api')) {
    return applySecurityHeaders(NextResponse.next())
  }

  try {
    if (
      shouldRejectPotentialCsrf({
        method: request.method,
        pathname,
        cookieHeader: request.headers.get('cookie'),
        originHeader: request.headers.get('origin'),
        refererHeader: request.headers.get('referer'),
        allowedOrigins: getAllowedOriginsForRequest(request),
      })
    ) {
      const forbidden = NextResponse.json(
        { error: 'Forbidden', message: 'Potential CSRF request was blocked.' },
        { status: 403 }
      )
      return applySecurityHeaders(forbidden)
    }

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
    return applySecurityHeaders(response)
  } catch (error) {
    // If rate limiting fails, allow the request through (fail open)
    // Log the error but don't block legitimate traffic
    console.error('Rate limiting error:', error)
    return applySecurityHeaders(NextResponse.next())
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
