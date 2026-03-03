'use client'

import { useEffect, useState, type ReactNode } from 'react'

interface DelayedRenderProps {
  children: ReactNode
  delayMs?: number
  placeholder?: ReactNode
}

export function DelayedRender({
  children,
  delayMs = 200,
  placeholder = null,
}: DelayedRenderProps) {
  const [showChildren, setShowChildren] = useState(delayMs <= 0)

  useEffect(() => {
    if (delayMs <= 0) {
      setShowChildren(true)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowChildren(true)
    }, delayMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [delayMs])

  return showChildren ? <>{children}</> : <>{placeholder}</>
}
