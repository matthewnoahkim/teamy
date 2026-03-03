'use client'

import type { ReactNode } from 'react'

interface PublicPageTransitionProps {
  children: ReactNode
}

export function PublicPageTransition({ children }: PublicPageTransitionProps) {
  return <>{children}</>
}
