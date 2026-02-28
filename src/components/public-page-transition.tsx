'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'

interface PublicPageTransitionProps {
  children: ReactNode
}

export function PublicPageTransition({ children }: PublicPageTransitionProps) {
  const pathname = usePathname()
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return <div>{children}</div>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
