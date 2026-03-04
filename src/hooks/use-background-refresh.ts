'use client'

import { useEffect, useRef } from 'react'

type BackgroundRefreshOptions = {
  /**
   * How often to run the refresh callback (ms). Set to 0 to disable polling.
   */
  intervalMs?: number
  /**
   * Immediately invoke the callback once the hook mounts (if the tab is visible).
   */
  runOnMount?: boolean
  /**
   * Re-run the callback whenever the window/tab regains focus.
   */
  refreshOnFocus?: boolean
  /**
   * Re-run the callback when the browser goes back online.
   */
  refreshOnReconnect?: boolean
  /**
   * Toggle the entire refresh behavior on/off.
   */
  enabled?: boolean
  /**
   * Ignore duplicate triggers fired within this window (ms).
   */
  dedupeWindowMs?: number
}

const defaultOptions: Required<BackgroundRefreshOptions> = {
  intervalMs: 45_000,
  runOnMount: false,
  refreshOnFocus: true,
  refreshOnReconnect: true,
  enabled: true,
  dedupeWindowMs: 750,
}

/**
 * Lightweight helper that keeps arbitrary data sources in sync without reloading pages.
 * It only fires when the tab is visible and the browser is online to minimize noise.
 */
export function useBackgroundRefresh(
  refreshFn: () => Promise<void> | void,
  options?: BackgroundRefreshOptions,
) {
  const opts = { ...defaultOptions, ...options }
  const callbackRef = useRef(refreshFn)
  const isRefreshingRef = useRef(false)
  const lastRunStartedAtRef = useRef(0)

  useEffect(() => {
    callbackRef.current = refreshFn
  }, [refreshFn])

  useEffect(() => {
    if (!opts.enabled) return
    if (typeof window === 'undefined') return

    let intervalId: ReturnType<typeof setInterval> | undefined
    let destroyed = false

    const canRun = () =>
      document.visibilityState === 'visible' &&
      (typeof navigator === 'undefined' || navigator.onLine)

    const run = async () => {
      if (isRefreshingRef.current || destroyed) return
      if (!canRun()) return
      const now = Date.now()
      if (now - lastRunStartedAtRef.current < opts.dedupeWindowMs) return

      lastRunStartedAtRef.current = now
      isRefreshingRef.current = true
      try {
        await callbackRef.current()
      } catch (err) {
        console.error('Background refresh failed:', err)
      } finally {
        isRefreshingRef.current = false
      }
    }

    if (opts.runOnMount) {
      run()
    }

    if (opts.intervalMs > 0) {
      intervalId = setInterval(run, opts.intervalMs)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && opts.refreshOnFocus) {
        run()
      }
    }

    const handleFocus = () => {
      if (opts.refreshOnFocus) {
        run()
      }
    }

    const handleReconnect = () => {
      if (opts.refreshOnReconnect) {
        run()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleReconnect)

    return () => {
      destroyed = true
      if (intervalId) {
        clearInterval(intervalId)
      }
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleReconnect)
    }
  }, [
    opts.enabled,
    opts.dedupeWindowMs,
    opts.intervalMs,
    opts.refreshOnFocus,
    opts.refreshOnReconnect,
    opts.runOnMount,
  ])
}

