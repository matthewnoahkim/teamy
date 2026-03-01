import test from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedOrigin, resolveSafeCallbackPath } from '@/lib/url-safety'

test('resolveSafeCallbackPath keeps safe relative paths', () => {
  const result = resolveSafeCallbackPath('/club/abc?tab=tests', '/auth/callback', [])
  assert.equal(result, '/club/abc?tab=tests')
})

test('resolveSafeCallbackPath normalizes allowed absolute URLs to internal paths', () => {
  const result = resolveSafeCallbackPath(
    'https://teamy.site/billing?success=true',
    '/auth/callback',
    ['https://teamy.site']
  )
  assert.equal(result, '/billing?success=true')
})

test('resolveSafeCallbackPath rejects external callback URLs', () => {
  const result = resolveSafeCallbackPath(
    'https://attacker.example/phishing',
    '/auth/callback',
    ['https://teamy.site']
  )
  assert.equal(result, '/auth/callback')
})

test('resolveSafeCallbackPath rejects protocol-relative callback URLs', () => {
  const result = resolveSafeCallbackPath('//attacker.example/phishing', '/auth/callback', [])
  assert.equal(result, '/auth/callback')
})

test('isTrustedOrigin allows trusted origins and rejects untrusted ones', () => {
  assert.equal(isTrustedOrigin(null, ['https://teamy.site']), true)
  assert.equal(isTrustedOrigin('https://teamy.site', ['https://teamy.site']), true)
  assert.equal(isTrustedOrigin('https://evil.example', ['https://teamy.site']), false)
  assert.equal(isTrustedOrigin('not-a-url', ['https://teamy.site']), false)
})
