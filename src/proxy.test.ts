import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { getAllowedOriginsForRequest } from '@/proxy'

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

test('getAllowedOriginsForRequest includes current request origin for preview/custom domains', () => {
  const origins = withEnv(
    {
      NODE_ENV: 'production',
      NEXTAUTH_URL: 'https://teamy.site',
      NEXT_PUBLIC_BASE_URL: undefined,
      APP_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined,
    },
    () => {
      const request = new NextRequest('https://teamy-preview.vercel.app/api/memberships/abc', {
        method: 'DELETE',
      })
      return getAllowedOriginsForRequest(request)
    },
  )

  assert.equal(origins.includes('https://teamy.site'), true)
  assert.equal(origins.includes('https://teamy-preview.vercel.app'), true)
})

test('getAllowedOriginsForRequest accepts forwarded host/proto origin', () => {
  const origins = withEnv(
    {
      NODE_ENV: 'production',
      NEXTAUTH_URL: 'https://teamy.site',
      NEXT_PUBLIC_BASE_URL: undefined,
      APP_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined,
      TRUST_FORWARDED_HOST_ORIGIN: 'true',
    },
    () => {
      const request = new NextRequest('https://internal.vercel.local/api/memberships/abc', {
        method: 'DELETE',
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'teamy-staging.example.org',
        },
      })
      return getAllowedOriginsForRequest(request)
    },
  )

  assert.equal(origins.includes('https://teamy-staging.example.org'), true)
})

test('getAllowedOriginsForRequest ignores forwarded host/proto origin unless explicitly trusted', () => {
  const origins = withEnv(
    {
      NODE_ENV: 'production',
      NEXTAUTH_URL: 'https://teamy.site',
      NEXT_PUBLIC_BASE_URL: undefined,
      APP_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
      VERCEL_URL: undefined,
      TRUST_FORWARDED_HOST_ORIGIN: undefined,
    },
    () => {
      const request = new NextRequest('https://internal.vercel.local/api/memberships/abc', {
        method: 'DELETE',
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'teamy-staging.example.org',
        },
      })
      return getAllowedOriginsForRequest(request)
    },
  )

  assert.equal(origins.includes('https://teamy-staging.example.org'), false)
})
