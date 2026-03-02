import { getConfiguredAppOrigins, isTrustedOrigin } from '@/lib/url-safety'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const DEFAULT_EXEMPT_PATH_PREFIXES = ['/api/auth', '/api/stripe/webhook']
const SESSION_COOKIE_NAMES = ['__Secure-next-auth.session-token', 'next-auth.session-token'] as const

function parseCookieHeader(cookieHeader: string | null | undefined): Set<string> {
  if (!cookieHeader) return new Set()
  return new Set(
    cookieHeader
      .split(';')
      .map((part) => part.trim().split('=')[0]?.trim())
      .filter((name): name is string => Boolean(name))
  )
}

function extractOrigin(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function hasAuthSessionCookie(cookieHeader: string | null | undefined): boolean {
  const cookieNames = parseCookieHeader(cookieHeader)
  return SESSION_COOKIE_NAMES.some((cookieName) => cookieNames.has(cookieName))
}

export function shouldRejectPotentialCsrf(params: {
  method: string
  pathname: string
  cookieHeader?: string | null
  originHeader?: string | null
  refererHeader?: string | null
  exemptPathPrefixes?: string[]
  allowedOrigins?: string[]
}): boolean {
  const {
    method,
    pathname,
    cookieHeader,
    originHeader,
    refererHeader,
    exemptPathPrefixes = DEFAULT_EXEMPT_PATH_PREFIXES,
    allowedOrigins = getConfiguredAppOrigins(),
  } = params

  if (!pathname.startsWith('/api')) return false
  if (SAFE_METHODS.has(method.toUpperCase())) return false
  if (exemptPathPrefixes.some((prefix) => pathname.startsWith(prefix))) return false
  if (!hasAuthSessionCookie(cookieHeader)) return false
  if (allowedOrigins.length === 0) return false

  if (originHeader) {
    return !isTrustedOrigin(originHeader, allowedOrigins)
  }

  const refererOrigin = extractOrigin(refererHeader)
  if (refererOrigin) {
    return !isTrustedOrigin(refererOrigin, allowedOrigins)
  }

  // Missing Origin/Referer can happen with some non-browser clients. Keep compatibility.
  return false
}
