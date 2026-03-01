import test from 'node:test'
import assert from 'node:assert/strict'
import type { NextRequest } from 'next/server'
import { devNotFoundResponse } from '@/lib/dev/guard'

function makeRequest(accept: string): NextRequest {
  return {
    headers: new Headers({ accept }),
  } as unknown as NextRequest
}

test('devNotFoundResponse returns static HTML for browser requests', async () => {
  const response = await devNotFoundResponse(makeRequest('text/html'))
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8')
  const body = await response.text()
  assert.match(body, /404 - Not Found/)
})

test('devNotFoundResponse returns JSON for API clients', async () => {
  const response = await devNotFoundResponse(makeRequest('application/json'))
  assert.equal(response.status, 404)
  const json = (await response.json()) as { error: string }
  assert.equal(json.error, 'Not Found')
})
