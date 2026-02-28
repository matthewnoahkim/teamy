'use client'

import { useEffect, useState } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { ChevronUp } from 'lucide-react'

export function PublicPageTools() {
  const { scrollYProgress } = useScroll()
  const [showBackToTop, setShowBackToTop] = useState(false)

  const progressScaleX = useSpring(scrollYProgress, {
    stiffness: 130,
    damping: 22,
    mass: 0.15,
  })

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 420)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <motion.div
        aria-hidden
        className="fixed left-0 top-0 z-[10005] h-0.5 w-full origin-left bg-teamy-primary"
        style={{ scaleX: progressScaleX }}
      />

      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-5 z-[10001] inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-lg transition-colors hover:bg-muted"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </>
  )
}
