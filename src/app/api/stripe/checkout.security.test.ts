import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTrustedBillingBaseUrl } from '@/app/api/stripe/checkout/route'

function withEnv<T>(entries: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, process.env[key])
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    return fn()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

test('resolveTrustedBillingBaseUrl prefers configured HTTPS origin', () => {
  const result = withEnv(
    {
      NEXT_PUBLIC_BASE_URL: 'https://teamy.site',
      NEXTAUTH_URL: undefined,
      APP_URL: undefined,
      VERCEL_URL: undefined,
    },
    () => resolveTrustedBillingBaseUrl()
  )
  assert.equal(result, 'https://teamy.site')
})

test('resolveTrustedBillingBaseUrl normalizes vercel hostnames', () => {
  const result = withEnv(
    {
      NEXT_PUBLIC_BASE_URL: undefined,
      NEXTAUTH_URL: undefined,
      APP_URL: undefined,
      VERCEL_URL: 'teamy-app.vercel.app',
    },
    () => resolveTrustedBillingBaseUrl()
  )
  assert.equal(result, 'https://teamy-app.vercel.app')
})

test('resolveTrustedBillingBaseUrl uses localhost fallback outside production', () => {
  const result = withEnv(
    {
      NEXT_PUBLIC_BASE_URL: undefined,
      NEXTAUTH_URL: undefined,
      APP_URL: undefined,
      VERCEL_URL: undefined,
    },
    () => resolveTrustedBillingBaseUrl()
  )
  assert.equal(result, 'http://localhost:3000')
})

test('resolveTrustedBillingBaseUrl returns null in production when env is missing', () => {
  const result = withEnv(
    {
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: undefined,
      NEXTAUTH_URL: undefined,
      APP_URL: undefined,
      VERCEL_URL: undefined,
    },
    () => resolveTrustedBillingBaseUrl()
  )
  assert.equal(result, null)
})
