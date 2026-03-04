import test from 'node:test'
import assert from 'node:assert/strict'
import { hasAuthSessionCookie, shouldRejectPotentialCsrf } from '@/lib/csrf-guard'

test('hasAuthSessionCookie detects NextAuth session cookies', () => {
  assert.equal(
    hasAuthSessionCookie('theme=dark; __Secure-next-auth.session-token=abc123; foo=bar'),
    true
  )
  assert.equal(hasAuthSessionCookie('theme=dark; foo=bar'), false)
})

test('shouldRejectPotentialCsrf rejects cross-site state-changing requests with session cookies', () => {
  const blocked = shouldRejectPotentialCsrf({
    method: 'POST',
    pathname: '/api/clubs/join',
    cookieHeader: '__Secure-next-auth.session-token=abc123',
    originHeader: 'https://evil.example',
    allowedOrigins: ['https://teamy.site'],
  })
  assert.equal(blocked, true)
})

test('shouldRejectPotentialCsrf allows same-origin state-changing requests', () => {
  const blocked = shouldRejectPotentialCsrf({
    method: 'POST',
    pathname: '/api/clubs/join',
    cookieHeader: '__Secure-next-auth.session-token=abc123',
    originHeader: 'https://teamy.site',
    allowedOrigins: ['https://teamy.site'],
  })
  assert.equal(blocked, false)
})

test('shouldRejectPotentialCsrf does not block webhook/auth exempt routes', () => {
  const blockedWebhook = shouldRejectPotentialCsrf({
    method: 'POST',
    pathname: '/api/stripe/webhook',
    cookieHeader: '__Secure-next-auth.session-token=abc123',
    originHeader: 'https://evil.example',
    allowedOrigins: ['https://teamy.site'],
  })
  const blockedAuth = shouldRejectPotentialCsrf({
    method: 'POST',
    pathname: '/api/auth/callback/google',
    cookieHeader: '__Secure-next-auth.session-token=abc123',
    originHeader: 'https://evil.example',
    allowedOrigins: ['https://teamy.site'],
  })

  assert.equal(blockedWebhook, false)
  assert.equal(blockedAuth, false)
})

test('shouldRejectPotentialCsrf blocks authenticated writes with missing origin/referer in strict mode', () => {
  const blocked = shouldRejectPotentialCsrf({
    method: 'POST',
    pathname: '/api/clubs/join',
    cookieHeader: '__Secure-next-auth.session-token=abc123',
    allowedOrigins: ['https://teamy.site'],
    requireOriginForAuthenticatedWrites: true,
  })

  assert.equal(blocked, true)
})

test('shouldRejectPotentialCsrf allows authenticated writes with missing origin/referer when strict mode disabled', () => {
  const blocked = shouldRejectPotentialCsrf({
    method: 'POST',
    pathname: '/api/clubs/join',
    cookieHeader: '__Secure-next-auth.session-token=abc123',
    allowedOrigins: ['https://teamy.site'],
    requireOriginForAuthenticatedWrites: false,
  })

  assert.equal(blocked, false)
})
