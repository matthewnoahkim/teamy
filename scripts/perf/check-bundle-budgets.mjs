#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'

const projectRoot = process.cwd()
const prodManifestPath = path.join(projectRoot, '.next', 'build-manifest.json')
const devManifestPath = path.join(projectRoot, '.next', 'dev', 'build-manifest.json')
const appRoutesManifestPath = path.join(projectRoot, '.next', 'app-path-routes-manifest.json')
const staticChunksDir = path.join(projectRoot, '.next', 'static', 'chunks')

const rootBudgetKb = Number(process.env.ROOT_MAIN_BUDGET_KB || 560)
const routeBudgetKb = Number(process.env.ROUTE_CHUNK_BUDGET_KB || 240)
const enforceDevBudgets = process.env.ENFORCE_DEV_BUNDLE_BUDGETS === 'true'

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function getFileSizeSafe(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.size
  } catch {
    return 0
  }
}

function unique(values) {
  return [...new Set(values)]
}

function bytesToKb(bytes) {
  return bytes / 1024
}

async function listFilesRecursive(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      files.push(...(await listFilesRecursive(fullPath)))
      continue
    }
    files.push(fullPath)
  }

  return files
}

async function sumChunkSizes(chunkFiles, baseDir) {
  let total = 0
  for (const chunkFile of unique(chunkFiles)) {
    const fullPath = path.join(baseDir, chunkFile)
    // eslint-disable-next-line no-await-in-loop
    total += await getFileSizeSafe(fullPath)
  }
  return total
}

async function main() {
  const hasProdManifest = await fileExists(prodManifestPath)
  const hasDevManifest = await fileExists(devManifestPath)

  if (!hasProdManifest && !hasDevManifest) {
    console.error('No Next.js build manifest found. Run `npm run build` first.')
    process.exit(1)
  }

  const useProd = hasProdManifest
  const manifestPath = useProd ? prodManifestPath : devManifestPath
  const manifest = await readJson(manifestPath)
  const manifestDir = path.dirname(manifestPath)

  const rootMainFiles = manifest.rootMainFiles || []
  const polyfillFiles = manifest.polyfillFiles || []
  const rootFiles = unique([...rootMainFiles, ...polyfillFiles])

  const rootBytes = await sumChunkSizes(rootFiles, manifestDir.includes(`${path.sep}dev`) ? manifestDir : path.join(projectRoot, '.next'))
  const rootKb = bytesToKb(rootBytes)

  let routeBudgetFailures = 0
  const routeResults = []
  let routeResultLabel = 'Largest route chunks'
  const pages = manifest.pages || {}
  const pageRouteEntries = Object.entries(pages).filter(([route]) => route !== '/_app' && route !== '/_error')

  if (pageRouteEntries.length > 0) {
    for (const [route, files] of pageRouteEntries) {
      // eslint-disable-next-line no-await-in-loop
      const bytes = await sumChunkSizes(files || [], manifestDir.includes(`${path.sep}dev`) ? manifestDir : path.join(projectRoot, '.next'))
      const kb = bytesToKb(bytes)
      routeResults.push({ route, kb })
      if (kb > routeBudgetKb) {
        routeBudgetFailures += 1
      }
    }
  } else if (useProd && await fileExists(appRoutesManifestPath) && await fileExists(staticChunksDir)) {
    routeResultLabel = 'Largest client chunks (app-router fallback)'
    const chunkFiles = await listFilesRecursive(staticChunksDir)
    const relativeChunkFiles = chunkFiles
      .filter((filePath) => filePath.endsWith('.js'))
      .map((filePath) => path.relative(path.join(projectRoot, '.next'), filePath).replaceAll(path.sep, '/'))

    for (const chunkPath of unique(relativeChunkFiles)) {
      // eslint-disable-next-line no-await-in-loop
      const bytes = await getFileSizeSafe(path.join(projectRoot, '.next', chunkPath))
      const kb = bytesToKb(bytes)
      routeResults.push({ route: chunkPath, kb })
      if (kb > routeBudgetKb) {
        routeBudgetFailures += 1
      }
    }
  }

  routeResults.sort((a, b) => b.kb - a.kb)

  console.log(`Manifest: ${manifestPath}`)
  console.log(`Mode: ${useProd ? 'production' : 'development'}\n`)
  console.log(`Root/main JS: ${rootKb.toFixed(1)} KB (budget ${rootBudgetKb} KB)`)

  if (routeResults.length > 0) {
    console.log(`\n${routeResultLabel}`)
    for (const route of routeResults.slice(0, 12)) {
      console.log(`${route.kb.toFixed(1).padStart(7, ' ')} KB  ${route.route}`)
    }
  }

  if (!useProd && !enforceDevBudgets) {
    console.log('\nDevelopment manifest detected; skipping strict budget enforcement.')
    process.exit(0)
  }

  let failures = 0
  if (rootKb > rootBudgetKb) {
    console.error(`Root/main JS budget exceeded: ${rootKb.toFixed(1)} KB > ${rootBudgetKb} KB`)
    failures += 1
  }
  if (routeBudgetFailures > 0) {
    console.error(`Route chunk budget exceeded on ${routeBudgetFailures} route(s).`)
    failures += 1
  }

  if (failures > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Bundle budget check crashed:', error)
  process.exit(1)
})
