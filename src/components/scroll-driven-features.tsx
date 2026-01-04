'use client'

import { useEffect, useRef, useState } from 'react'
import { 
  MessageSquare, 
  Calendar, 
  ClipboardCheck, 
  FileText, 
  BarChart3, 
  FolderKanban, 
  DollarSign, 
  Wrench 
} from 'lucide-react'

const iconMap = {
  MessageSquare,
  Calendar,
  ClipboardCheck,
  FileText,
  BarChart3,
  FolderKanban,
  DollarSign,
  Wrench,
}

interface Feature {
  icon: keyof typeof iconMap
  title: string
  description: string
}

interface ScrollDrivenFeaturesProps {
  features: Feature[]
}

export function ScrollDrivenFeatures({ features }: ScrollDrivenFeaturesProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [minHeight, setMinHeight] = useState(`${features.length * 50}vh`)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Adjust min-height for mobile
    const updateMinHeight = () => {
      if (window.innerWidth < 640) {
        setMinHeight(`${features.length * 40}vh`)
      } else {
        setMinHeight(`${features.length * 50}vh`)
      }
    }
    
    updateMinHeight()
    window.addEventListener('resize', updateMinHeight)
    
    return () => window.removeEventListener('resize', updateMinHeight)
  }, [features.length])

  useEffect(() => {
    let rafId: number | null = null
    
    const handleScroll = () => {
      if (rafId) return
      
      rafId = requestAnimationFrame(() => {
        if (!containerRef.current) {
          rafId = null
          return
        }

        const container = containerRef.current
        const rect = container.getBoundingClientRect()
        
        const scrollProgress = Math.max(0, -rect.top) / (container.offsetHeight - window.innerHeight)
        const clampedProgress = Math.max(0, Math.min(1, scrollProgress))
        const index = Math.min(
          Math.floor(clampedProgress * features.length),
          features.length - 1
        )
        
        setActiveIndex(Math.max(0, index))
        rafId = null
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [features.length])

  const handleFeatureClick = (clickedIndex: number) => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerTop = window.scrollY + containerRect.top
    const containerHeight = container.offsetHeight
    const viewportHeight = window.innerHeight
    const scrollableHeight = Math.max(0, containerHeight - viewportHeight)
    
    // Match the scroll handler's calculation logic:
    // scrollProgress = -rect.top / scrollableHeight
    // index = Math.floor(scrollProgress * features.length)
    // To target a specific index, we want scrollProgress to be in the middle of that index's range
    const targetProgress = (clickedIndex + 0.5) / features.length
    const targetRectTop = -targetProgress * scrollableHeight
    
    // rect.top = containerTop - window.scrollY
    // So: window.scrollY = containerTop - rect.top
    const targetWindowScroll = containerTop - targetRectTop
    
    // Scroll to the target position
    window.scrollTo({
      top: Math.max(0, targetWindowScroll),
      behavior: 'smooth'
    })
  }

  return (
    <div ref={containerRef} className="relative pb-2" style={{ minHeight }}>
      <div className="sticky top-16 sm:top-20 h-[85vh] sm:h-[75vh] lg:h-[70vh] flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center min-h-0">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12 lg:mb-16 flex-shrink-0">
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-3 sm:mb-4 tracking-tight">
              Features
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Everything you need to manage your Science Olympiad team
            </p>
          </div>
          
          {/* Feature showcase */}
          <div className="flex flex-col lg:grid lg:grid-cols-[1.1fr,1fr] gap-8 sm:gap-12 lg:gap-16 items-center flex-shrink-0">
            {/* Left: Feature List */}
            <div className="w-full lg:w-auto space-y-1 sm:space-y-2 order-2 lg:order-1">
              {features.map((feature, index) => {
                const isActive = index === activeIndex
                const Icon = iconMap[feature.icon]

                return (
                  <div
                    key={feature.title}
                    className={`group relative transition-all duration-700 ease-out cursor-pointer pl-4 sm:pl-5 ${
                      isActive 
                        ? 'opacity-100 translate-x-0' 
                        : 'opacity-30 translate-x-[-8px] hover:opacity-50'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFeatureClick(index)
                    }}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 py-2 sm:py-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 transition-all duration-500 ${
                        isActive 
                          ? 'opacity-100 translate-x-0' 
                          : 'opacity-0 -translate-x-4'
                      }`}>
                        <Icon 
                          className={`h-5 w-5 sm:h-6 sm:w-6 transition-colors duration-500 ${
                            isActive ? 'text-teamy-primary' : 'text-muted-foreground'
                          }`} 
                          strokeWidth={2}
                        />
                      </div>
                      
                      {/* Title */}
                      <h3
                        className={`font-heading text-xl sm:text-2xl md:text-3xl font-semibold transition-all duration-500 ${
                          isActive 
                            ? 'text-foreground scale-100' 
                            : 'text-muted-foreground scale-[0.98]'
                        }`}
                      >
                        {feature.title}
                      </h3>
                    </div>
                    
                    {/* Active indicator line */}
                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-teamy-primary transition-all duration-700 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`} />
                  </div>
                )
              })}
            </div>

            {/* Right: Scroll-driven feature card */}
            <div className="w-full lg:w-auto h-[320px] sm:h-[400px] md:h-[450px] lg:h-[500px] mt-0 lg:mt-0 order-1 lg:order-2">
              <div className="relative h-full rounded-2xl overflow-hidden bg-card border border-border shadow-card dark:shadow-lg p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center">
                
                {features.map((feature, index) => {
                  const Icon = iconMap[feature.icon]
                  const isActive = index === activeIndex
                  const progress = activeIndex === index ? 1 : 0

                  return (
                    <div
                      key={feature.title}
                      className={`absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8 md:p-10 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        isActive 
                          ? 'opacity-100 scale-100 translate-y-0' 
                          : 'opacity-0 scale-[0.96] translate-y-4'
                      }`}
                      style={{
                        transform: isActive 
                          ? 'translateY(0) scale(1)' 
                          : 'translateY(16px) scale(0.96)',
                      }}
                    >
                      {/* Icon container with modern design */}
                      <div className="relative mb-6 sm:mb-8 w-full max-w-sm">
                        {/* Main icon background */}
                        <div
                          className="relative w-full h-28 sm:h-36 md:h-40 lg:h-44 rounded-2xl bg-teamy-primary/10 dark:bg-teamy-primary/15 flex items-center justify-center shadow-md border border-teamy-primary/20 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
                          style={{
                            transform: `scale(${0.95 + progress * 0.05})`,
                            opacity: 0.85 + progress * 0.15,
                          }}
                        >
                          <Icon 
                            className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 text-teamy-primary transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" 
                            strokeWidth={1.5}
                            style={{
                              transform: `scale(${0.9 + progress * 0.1})`,
                              opacity: 0.7 + progress * 0.3,
                            }}
                          />
                        </div>
                        
                        {/* Decorative accent rings */}
                        <div
                          className="absolute -inset-1 rounded-2xl border border-teamy-primary/20 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
                          style={{
                            transform: `scale(${0.95 + progress * 0.05})`,
                            opacity: progress * 0.2,
                          }}
                        />
                      </div>
                      
                      {/* Description */}
                      <div className="text-center max-w-lg px-2">
                        <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
