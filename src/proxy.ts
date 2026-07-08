// Site shutdown, API logging, rate limiting, and security middleware

import { NextRequest, NextResponse } from 'next/server'
import {
  getRateLimitKey,
  getRateLimitConfig,
  checkRateLimitAsync,
  getRateLimitHeaders,
} from '@/lib/rate-limit'
import { getSecurityHeaders } from '@/lib/security-config'
import { shouldRejectPotentialCsrf } from '@/lib/csrf-guard'
import { getConfiguredAppOrigins } from '@/lib/url-safety'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const SHUTDOWN_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const

function isSiteShutdownEnabled(): boolean {
  return process.env.SITE_SHUTDOWN_DISABLED !== 'true'
}

function getShutdownHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>Site unavailable</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
      }
      main {
        max-width: 520px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 32px;
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: #475569;
        font-size: 16px;
        line-height: 1.6;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background: #020617;
          color: #f8fafc;
        }
        p {
          color: #cbd5e1;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>This site is no longer available.</h1>
      <p>Teamy has been shut down.</p>
    </main>
  </body>
</html>`
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function getShutdownResponse(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const headers = { ...SHUTDOWN_HEADERS }

  if (request.method.toUpperCase() === 'HEAD') {
    return new NextResponse(null, { status: 410, headers })
  }

  if (isApiPath(pathname)) {
    return NextResponse.json(
      {
        error: 'Gone',
        message: 'Teamy has been shut down.',
      },
      { status: 410, headers },
    )
  }

  return new NextResponse(getShutdownHtml(), {
    status: 410,
    headers: {
      ...headers,
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

function shouldTrustForwardedHostOrigin(): boolean {
  return process.env.TRUST_FORWARDED_HOST_ORIGIN === 'true'
}

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

  if (shouldTrustForwardedHostOrigin()) {
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const forwardedHost = request.headers.get('x-forwarded-host')
    if (forwardedProto && forwardedHost) {
      addOrigin(`${forwardedProto}://${forwardedHost}`)
    }
  }

  return [...origins]
}

function isStateChangingMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase())
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

  if (isSiteShutdownEnabled()) {
    return applySecurityHeaders(getShutdownResponse(request))
  }

  if (!isApiPath(pathname)) {
    return NextResponse.next()
  }

  // Skip rate limiting for certain paths
  const skipPaths = [
    '/api/auth/callback', // OAuth callbacks need to work
    '/api/auth/session', // Session checks are frequent
  ]

  if (skipPaths.some(path => pathname.startsWith(path))) {
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
        requireOriginForAuthenticatedWrites: process.env.NODE_ENV === 'production',
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
    const result = await checkRateLimitAsync(rateLimitKey, config)

    // If rate limited, return 429 Too Many Requests
    if (!result.allowed) {
      const headers = getRateLimitHeaders(result)

      const limited = NextResponse.json(
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
      return applySecurityHeaders(limited)
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next()
    const rateLimitHeaders = getRateLimitHeaders(result)

    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, String(value))
    })
    return applySecurityHeaders(response)
  } catch (error) {
    // Fail closed for state-changing requests so security checks can't be bypassed.
    console.error('API security middleware error:', error)
    if (isStateChangingMethod(request.method)) {
      const unavailable = NextResponse.json(
        { error: 'Service Unavailable', message: 'Request blocked due to temporary security service failure.' },
        { status: 503 }
      )
      return applySecurityHeaders(unavailable)
    }

    return applySecurityHeaders(NextResponse.next())
  }
}

export const config = {
  // Run for all routes so the code-level shutdown covers pages, static assets, and APIs.
  matcher: ['/:path*'],
}
