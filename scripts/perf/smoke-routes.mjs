#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'

const APP_DIR = path.join(process.cwd(), 'src', 'app')
const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12000)
const CONCURRENCY = Math.max(1, Number(process.env.SMOKE_CONCURRENCY || 8))

/**
 * @typedef {{ route: string, dynamic: boolean }} RouteEntry
 * @typedef {{ route: string, url: string, status: number, ms: number, dynamic: boolean, error?: string }} SmokeResult
 */

const DYNAMIC_VALUE_MAP = {
  clubId: process.env.SMOKE_CLUB_ID || 'smoke-club',
  tournamentId: process.env.SMOKE_TOURNAMENT_ID || 'smoke-tournament',
  param: process.env.SMOKE_TOURNAMENT_PARAM || 'smoke-param',
  testId: process.env.SMOKE_TEST_ID || 'smoke-test',
  attemptId: process.env.SMOKE_ATTEMPT_ID || 'smoke-attempt',
  membershipId: process.env.SMOKE_MEMBERSHIP_ID || 'smoke-membership',
  userId: process.env.SMOKE_USER_ID || 'smoke-user',
  slug: process.env.SMOKE_SLUG || 'smoke-slug',
  id: process.env.SMOKE_ID || 'smoke-id',
  token: process.env.SMOKE_TOKEN || 'smoke-token',
  code: process.env.SMOKE_CODE || 'smoke-code',
}

function isRouteGroup(segment) {
  return segment.startsWith('(') && segment.endsWith(')')
}

function isParallelRouteSegment(segment) {
  return segment.startsWith('@')
}

function isInterceptSegment(segment) {
  return segment.startsWith('(.)') || segment.startsWith('(..') || segment.startsWith('(...)')
}

function resolveDynamicSegment(segment) {
  const optionalCatchAllMatch = /^\[\[\.\.\.(.+)\]\]$/.exec(segment)
  if (optionalCatchAllMatch) {
    const key = optionalCatchAllMatch[1]
    return DYNAMIC_VALUE_MAP[key] || `smoke-${key}`
  }

  const catchAllMatch = /^\[\.\.\.(.+)\]$/.exec(segment)
  if (catchAllMatch) {
    const key = catchAllMatch[1]
    return DYNAMIC_VALUE_MAP[key] || `smoke-${key}`
  }

  const dynamicMatch = /^\[(.+)\]$/.exec(segment)
  if (dynamicMatch) {
    const key = dynamicMatch[1]
    return DYNAMIC_VALUE_MAP[key] || `smoke-${key}`
  }

  return segment
}

async function walkPages(dir, collector) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walkPages(fullPath, collector)
      continue
    }
    if (entry.isFile() && entry.name === 'page.tsx') {
      collector.push(fullPath)
    }
  }
}

/**
 * @returns {Promise<RouteEntry[]>}
 */
async function discoverRoutes() {
  const pageFiles = []
  await walkPages(APP_DIR, pageFiles)

  /** @type {RouteEntry[]} */
  const routes = []
  const seen = new Set()

  for (const file of pageFiles) {
    const relDir = path.relative(APP_DIR, path.dirname(file))
    const segments = relDir.split(path.sep).filter(Boolean)
    if (segments[0] === 'api') continue

    /** @type {string[]} */
    const routeSegments = []
    let dynamic = false

    for (const segment of segments) {
      if (isRouteGroup(segment) || isParallelRouteSegment(segment) || isInterceptSegment(segment)) {
        continue
      }
      const resolved = resolveDynamicSegment(segment)
      if (resolved !== segment) {
        dynamic = true
      }
      routeSegments.push(resolved)
    }

    const route = routeSegments.length === 0 ? '/' : `/${routeSegments.join('/')}`
    if (seen.has(route)) continue
    seen.add(route)
    routes.push({ route, dynamic })
  }

  routes.sort((a, b) => a.route.localeCompare(b.route))
  return routes
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const startedAt = performance.now()
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    const ms = performance.now() - startedAt
    return { response, ms }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * @param {RouteEntry} routeEntry
 * @returns {Promise<SmokeResult>}
 */
async function checkRoute(routeEntry) {
  const url = `${BASE_URL}${routeEntry.route === '/' ? '' : routeEntry.route}`
  try {
    const { response, ms } = await fetchWithTimeout(url)
    return {
      route: routeEntry.route,
      url,
      status: response.status,
      ms: Number(ms.toFixed(1)),
      dynamic: routeEntry.dynamic,
    }
  } catch (error) {
    return {
      route: routeEntry.route,
      url,
      status: 0,
      ms: REQUEST_TIMEOUT_MS,
      dynamic: routeEntry.dynamic,
      error: error instanceof Error ? error.message : 'unknown error',
    }
  }
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} chunkSize
 * @returns {T[][]}
 */
function chunk(items, chunkSize) {
  const chunks = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function shouldFail(result) {
  if (result.error) return true
  if (result.status >= 500) return true
  if (!result.dynamic && result.status >= 400 && result.status !== 401 && result.status !== 403) {
    return true
  }
  return false
}

function shouldWarn(result) {
  if (result.error || result.status === 0) return false
  if (result.status >= 400) return true
  if (result.ms > Number(process.env.SMOKE_ROUTE_WARN_MS || 2000)) return true
  return false
}

async function main() {
  const routes = await discoverRoutes()
  if (routes.length === 0) {
    console.error('No app routes discovered.')
    process.exit(1)
  }

  console.log(`Discovered ${routes.length} routes. Base URL: ${BASE_URL}`)

  /** @type {SmokeResult[]} */
  const results = []
  for (const group of chunk(routes, CONCURRENCY)) {
    // eslint-disable-next-line no-await-in-loop
    const groupResults = await Promise.all(group.map(checkRoute))
    results.push(...groupResults)
  }

  const failures = results.filter(shouldFail)
  const warnings = results.filter(shouldWarn).filter((r) => !shouldFail(r))
  const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 12)

  for (const result of results) {
    const marker = shouldFail(result) ? 'FAIL' : shouldWarn(result) ? 'WARN' : 'OK  '
    const status = result.status === 0 ? 'ERR' : String(result.status)
    const suffix = result.error ? ` (${result.error})` : ''
    console.log(`${marker} ${status.padStart(3, ' ')} ${result.ms.toString().padStart(6, ' ')}ms  ${result.route}${suffix}`)
  }

  console.log('\nSummary')
  console.log(`Total routes: ${results.length}`)
  console.log(`Failures: ${failures.length}`)
  console.log(`Warnings: ${warnings.length}`)

  if (slowest.length > 0) {
    console.log('\nSlowest routes')
    for (const entry of slowest) {
      console.log(`${entry.ms.toString().padStart(6, ' ')}ms  ${entry.route} [${entry.status || 'ERR'}]`)
    }
  }

  if (failures.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Route smoke test crashed:', error)
  process.exit(1)
})
