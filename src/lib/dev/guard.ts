/**
 * Guard for /api/dev/* routes that return sensitive data.
 * In production: require either (1) valid x-internal-api-key or (2) session + dev whitelist.
 * Denied requests get 404 to avoid leaking that the route exists.
 * Never log full user payloads; log only IP, user-agent, timestamp for denied attempts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/rate-limit'
import crypto from 'crypto'

const INTERNAL_KEY_HEADER = 'x-internal-api-key'
const ENV_KEY = 'INTERNAL_API_KEY'

function isProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  )
}

/**
 * Constant-time comparison for API key to prevent timing attacks.
 */
function secureCompare(provided: string): boolean {
  const key = process.env[ENV_KEY]
  if (!key || typeof key !== 'string') return false
  try {
    const bufA = Buffer.from(provided, 'utf8')
    const bufB = Buffer.from(key, 'utf8')
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

/**
 * Check if request has valid internal API key (server-side only).
 */
function hasValidInternalKey(request: NextRequest): boolean {
  const provided = request.headers.get(INTERNAL_KEY_HEADER)
  if (!provided || typeof provided !== 'string') return false
  return secureCompare(provided.trim())
}

async function checkDevWhitelist(email: string): Promise<boolean> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'dev_panel_email_whitelist' },
  })
  let whitelist: string[] = []
  if (setting) {
    try {
      const parsed = JSON.parse(setting.value)
      if (Array.isArray(parsed)) whitelist = parsed.map((e: string) => e.toLowerCase().trim())
    } catch {
      whitelist = []
    }
  }
  if (whitelist.length === 0) {
    const env = process.env.DEV_PANEL_DEFAULT_EMAILS
    if (env) {
      whitelist = env.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0 && e.includes('@'))
    }
  }
  return whitelist.some(e => e === email.toLowerCase().trim())
}

/**
 * Log a denied attempt. Only IP, user-agent, timestamp, and route — never user payloads.
 */
function logDenied(route: string, request: NextRequest, reason: string): void {
  const ip = getClientIp(request)
  const ua = request.headers.get('user-agent') ?? '(none)'
  const ts = new Date().toISOString()
  console.warn(`[dev-guard] Denied access to ${route}: ${reason} | ip=${ip} | userAgent=${ua} | at=${ts}`)
}

/**
 * Require dev access for sensitive /api/dev/* handlers.
 * Call at the very top of the handler; short-circuits before any heavy DB work for unauthorized requests.
 * In production, returns 404 when not allowed (to avoid leaking route existence).
 *
 * Usage:
 *   const guard = await requireDevAccess(request, '/api/dev/users')
 *   if (!guard.allowed) return guard.response
 */
export async function requireDevAccess(
  request: NextRequest,
  routeLabel: string
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  // 1) Internal API key (no DB, no session) — check first for fast path and server-to-server
  if (hasValidInternalKey(request)) {
    return { allowed: true }
  }

  // 2) Session + dev whitelist
  const session = await getServerSession(authOptions)
  if (session?.user?.email) {
    const onWhitelist = await checkDevWhitelist(session.user.email)
    if (onWhitelist) return { allowed: true }
  }

  // Not allowed
  if (isProduction()) {
    logDenied(routeLabel, request, 'unauthorized or not on dev whitelist')
    return {
      allowed: false,
      response: new NextResponse(null, { status: 404, statusText: 'Not Found' }),
    }
  }

  // Non-production: still deny but can use 403 so devs see it's an auth issue
  logDenied(routeLabel, request, 'unauthorized or not on dev whitelist')
  return {
    allowed: false,
    response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  }
}
