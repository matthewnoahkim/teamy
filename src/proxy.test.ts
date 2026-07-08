import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import proxy, { getAllowedOriginsForRequest } from '@/proxy'

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

async function withEnvAsync<T>(
  entries: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
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
    return await fn()
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

test('proxy returns a shutdown page by default', async () => {
  const response = await withEnvAsync(
    { SITE_SHUTDOWN_DISABLED: undefined },
    () => proxy(new NextRequest('https://teamy.site/pricing')),
  )

  assert.equal(response.status, 410)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8')
  assert.match(await response.text(), /This site is no longer available/)
})

test('proxy returns a shutdown JSON response for API routes by default', async () => {
  const response = await withEnvAsync(
    { SITE_SHUTDOWN_DISABLED: undefined },
    () => proxy(new NextRequest('https://teamy.site/api/clubs')),
  )

  assert.equal(response.status, 410)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), {
    error: 'Gone',
    message: 'The SciolyTeams service has been shut down.',
  })
})

test('proxy lets non-API routes pass through when shutdown is explicitly disabled', async () => {
  const response = await withEnvAsync(
    { SITE_SHUTDOWN_DISABLED: 'true' },
    () => proxy(new NextRequest('https://teamy.site/pricing')),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-robots-tag'), null)
})

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
