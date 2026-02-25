/**
 * Guard for /api/dev/* routes that return sensitive data.
 * Require either (1) valid x-internal-api-key or (2) session + dev whitelist.
 * Denied requests are redirected to /404 so users land on the custom not-found page.
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
 * Log a denied attempt. Only IP, user-agent, timestamp, and route - never user payloads.
 */
function logDenied(route: string, request: NextRequest, reason: string): void {
  const ip = getClientIp(request)
  const ua = request.headers.get('user-agent') ?? '(none)'
  const ts = new Date().toISOString()
  console.warn(`[dev-guard] Denied access to ${route}: ${reason} | ip=${ip} | userAgent=${ua} | at=${ts}`)
}

export async function devNotFoundResponse(request: NextRequest): Promise<NextResponse> {
  const accept = request.headers.get('accept')?.toLowerCase() ?? ''
  const wantsHtml = accept.includes('text/html')

  if (wantsHtml) {
    try {
      const notFoundUrl = new URL('/404', request.url)
      const notFoundPage = await fetch(notFoundUrl.toString(), {
        headers: { accept: 'text/html' },
        cache: 'no-store',
      })

      const html = await notFoundPage.text()
      return new NextResponse(html, {
        status: 404,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    } catch (error) {
      console.error('[dev-guard] Failed to load custom 404 page:', error)
    }
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 })
}

/**
 * Require dev access for sensitive /api/dev/* handlers.
 * Call at the very top of the handler; short-circuits before any heavy DB work for unauthorized requests.
 * Returns a redirect to the custom /404 page when not allowed (to avoid leaking route existence).
 *
 * Usage:
 *   const guard = await requireDevAccess(request, '/api/dev/users')
 *   if (!guard.allowed) return guard.response
 */
export async function requireDevAccess(
  request: NextRequest,
  routeLabel: string
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  // 1) Internal API key (no DB, no session) - check first for fast path and server-to-server
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
  logDenied(routeLabel, request, 'unauthorized or not on dev whitelist')
  return {
    allowed: false,
    response: await devNotFoundResponse(request),
  }
}
