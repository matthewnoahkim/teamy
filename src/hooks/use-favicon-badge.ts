'use client'

import { useEffect } from 'react'
import { updateFaviconBadgeWithImage } from '@/lib/favicon-badge'

/**
 * Hook to update the favicon badge based on unread count
 * 
 * @param count - Number of unread items (0 to hide badge)
 * @param faviconUrl - Optional custom favicon URL (defaults to /logo-64.png)
 */
export function useFaviconBadge(count: number, faviconUrl?: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Use the provided favicon URL or default to /logo-64.png
    // The canvas-drawn version ensures it works everywhere
    updateFaviconBadgeWithImage(count, faviconUrl || '/logo-64.png').catch(() => {
      // Error already logged in updateFaviconBadgeWithImage
    })
  }, [count, faviconUrl])
}
