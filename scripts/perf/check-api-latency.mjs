#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api')
const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = Number(process.env.API_SMOKE_TIMEOUT_MS || 12000)
const ITERATIONS = Math.max(1, Number(process.env.API_LATENCY_ITERATIONS || 5))
const P95_BUDGET_MS = Number(process.env.API_P95_BUDGET_MS || 1200)
const P50_BUDGET_MS = Number(process.env.API_P50_BUDGET_MS || 700)

const DYNAMIC_VALUE_MAP = {
  clubId: process.env.SMOKE_CLUB_ID || 'smoke-club',
  tournamentId: process.env.SMOKE_TOURNAMENT_ID || 'smoke-tournament',
  param: process.env.SMOKE_TOURNAMENT_PARAM || 'smoke-param',
  testId: process.env.SMOKE_TEST_ID || 'smoke-test',
  attemptId: process.env.SMOKE_ATTEMPT_ID || 'smoke-attempt',
  membershipId: process.env.SMOKE_MEMBERSHIP_ID || 'smoke-membership',
  userId: process.env.SMOKE_USER_ID || 'smoke-user',
  id: process.env.SMOKE_ID || 'smoke-id',
  slug: process.env.SMOKE_SLUG || 'smoke-slug',
  code: process.env.SMOKE_CODE || 'invalid-code',
}

function resolveSegment(segment) {
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

async function walkRoutes(dir, collector) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walkRoutes(fullPath, collector)
      continue
    }
    if (entry.isFile() && entry.name === 'route.ts') {
      collector.push(fullPath)
    }
  }
}

async function discoverApiRoutes() {
  const routeFiles = []
  await walkRoutes(API_DIR, routeFiles)

  const routes = new Set()
  for (const file of routeFiles) {
    const relDir = path.relative(API_DIR, path.dirname(file))
    const segments = relDir
      .split(path.sep)
      .filter(Boolean)
      .map(resolveSegment)
    const route = segments.length ? `/api/${segments.join('/')}` : '/api'
    routes.add(route)
  }

  return [...routes].sort((a, b) => a.localeCompare(b))
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
        Accept: 'application/json,text/plain,*/*',
      },
    })
    let bodyText = ''
    try {
      bodyText = await response.text()
    } catch {
      bodyText = ''
    }

    return {
      status: response.status,
      ms: performance.now() - startedAt,
      bodyText,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
}

async function runCoverage(routes) {
  let failures = 0
  for (const route of routes) {
    const url = `${BASE_URL}${route}`
    try {
      // eslint-disable-next-line no-await-in-loop
      const { status, ms, bodyText } = await fetchWithTimeout(url)
      const isExpectedSecurityDisabled =
        status === 503 && bodyText.includes('currently disabled due to security concerns')
      const marker =
        status >= 500 && !isExpectedSecurityDisabled
          ? 'FAIL'
          : status >= 400
          ? 'WARN'
          : 'OK  '
      console.log(`${marker} ${String(status).padStart(3, ' ')} ${ms.toFixed(1).padStart(7, ' ')}ms  ${route}`)
      if (status >= 500 && !isExpectedSecurityDisabled) {
        failures += 1
      }
    } catch (error) {
      failures += 1
      const message = error instanceof Error ? error.message : 'unknown error'
      console.log(`FAIL ERR ${REQUEST_TIMEOUT_MS.toString().padStart(7, ' ')}ms  ${route} (${message})`)
    }
  }
  return failures
}

async function sampleEndpoint(endpoint, iterations) {
  const samples = []
  let lastStatus = 0
  for (let i = 0; i < iterations; i += 1) {
    const url = `${BASE_URL}${endpoint}`
    // eslint-disable-next-line no-await-in-loop
    const { status, ms } = await fetchWithTimeout(url)
    samples.push(ms)
    lastStatus = status
  }
  return { endpoint, samples, status: lastStatus }
}

async function main() {
  const routes = await discoverApiRoutes()
  if (routes.length === 0) {
    console.error('No API routes discovered under src/app/api.')
    process.exit(1)
  }

  console.log(`Discovered ${routes.length} API routes. Base URL: ${BASE_URL}\n`)
  console.log('Coverage pass (GET smoke; 5xx is failure)')
  const coverageFailures = await runCoverage(routes)

  const clubId = DYNAMIC_VALUE_MAP.clubId
  const criticalEndpoints = [
    '/api/events?division=B',
    '/api/events?division=C',
    `/api/announcements?clubId=${encodeURIComponent(clubId)}`,
    `/api/calendar?clubId=${encodeURIComponent(clubId)}`,
    `/api/attendance?clubId=${encodeURIComponent(clubId)}`,
    `/api/tests?clubId=${encodeURIComponent(clubId)}`,
    `/api/clubs/${encodeURIComponent(clubId)}/notifications?tabs=stream,calendar,attendance,finance,tests,people`,
    `/api/clubs/${encodeURIComponent(clubId)}/invite/codes`,
    `/api/clubs/join?code=invalid&clubId=${encodeURIComponent(clubId)}`,
  ]

  console.log(`\nCritical endpoint latency samples (${ITERATIONS}x each)`)
  const sampleResults = []
  let sampleFailures = 0
  for (const endpoint of criticalEndpoints) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await sampleEndpoint(endpoint, ITERATIONS)
      sampleResults.push(result)
    } catch (error) {
      sampleFailures += 1
      const message = error instanceof Error ? error.message : 'unknown error'
      console.log(`FAIL ERR ${endpoint} (${message})`)
    }
  }

  let budgetFailures = 0
  for (const result of sampleResults) {
    const p50 = percentile(result.samples, 50)
    const p95 = percentile(result.samples, 95)
    const overBudget = p50 > P50_BUDGET_MS || p95 > P95_BUDGET_MS || result.status >= 500
    if (overBudget) budgetFailures += 1
    const marker = overBudget ? 'FAIL' : 'OK  '
    console.log(
      `${marker} ${String(result.status).padStart(3, ' ')} p50=${p50.toFixed(1).padStart(7, ' ')}ms p95=${p95.toFixed(1).padStart(7, ' ')}ms  ${result.endpoint}`,
    )
  }

  console.log('\nSummary')
  console.log(`Coverage failures (5xx/errors): ${coverageFailures}`)
  console.log(`Sampling request failures: ${sampleFailures}`)
  console.log(`Latency budget failures: ${budgetFailures}`)
  console.log(`Budgets: p50<=${P50_BUDGET_MS}ms, p95<=${P95_BUDGET_MS}ms`)

  if (coverageFailures > 0 || sampleFailures > 0 || budgetFailures > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('API latency check crashed:', error)
  process.exit(1)
})
