'use client'

import type { ReactNode } from 'react'

interface ScrollAnimateProps {
  children: ReactNode
  animation?: 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'scale-in' | 'fade-scale' | 'slide-up-rotate' | 'bounce-in' | 'elegant'
  delay?: number
  duration?: number
  threshold?: number
  className?: string
}

export function ScrollAnimate({
  children,
  className = '',
}: ScrollAnimateProps) {
  return <div className={className}>{children}</div>
}
