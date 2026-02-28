'use client'
import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

interface ScrollAnimateProps {
  children: ReactNode
  animation?: 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'scale-in' | 'fade-scale' | 'slide-up-rotate' | 'bounce-in' | 'elegant'
  delay?: number
  duration?: number
  threshold?: number
  className?: string
}

const animationVariants: Record<NonNullable<ScrollAnimateProps['animation']>, Variants> = {
  'fade-up': {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  'fade-in': {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1 },
  },
  'slide-left': {
    hidden: { opacity: 0, x: 36 },
    visible: { opacity: 1, x: 0 },
  },
  'slide-right': {
    hidden: { opacity: 0, x: -36 },
    visible: { opacity: 1, x: 0 },
  },
  'scale-in': {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1 },
  },
  'fade-scale': {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 },
  },
  'slide-up-rotate': {
    hidden: { opacity: 0, y: 28, rotate: 1.5 },
    visible: { opacity: 1, y: 0, rotate: 0 },
  },
  'bounce-in': {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: { opacity: 1, y: 0, scale: 1 },
  },
  'elegant': {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
}

export function ScrollAnimate({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 600,
  threshold = 0.1,
  className = ''
}: ScrollAnimateProps) {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: threshold, margin: '0px 0px -80px 0px' }}
      variants={animationVariants[animation]}
      transition={{
        duration: duration / 1000,
        delay: delay / 1000,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
