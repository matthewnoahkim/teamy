type ApiTimingMeta = Record<string, string | number | boolean | null | undefined>

export function logApiTiming(endpoint: string, startedAtMs: number, meta: ApiTimingMeta = {}) {
  const isProd = process.env.NODE_ENV === 'production'
  const enabledInDev = process.env.API_TIMING_LOGS === '1'
  if (!isProd && !enabledInDev) {
    return
  }

  const thresholdRaw = process.env.API_TIMING_LOG_THRESHOLD_MS
  const thresholdMs = thresholdRaw ? Number(thresholdRaw) : isProd ? 150 : 0
  const durationMs = Math.round((performance.now() - startedAtMs) * 100) / 100
  if (Number.isFinite(thresholdMs) && durationMs < thresholdMs) {
    return
  }

  console.info('[api-timing]', {
    endpoint,
    durationMs,
    ...meta,
  })
}
