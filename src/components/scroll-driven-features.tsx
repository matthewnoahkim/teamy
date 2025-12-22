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
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return

      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      
      const scrollProgress = Math.max(0, -rect.top) / (container.offsetHeight - window.innerHeight)
      const clampedProgress = Math.max(0, Math.min(1, scrollProgress))
      const index = Math.min(
        Math.floor(clampedProgress * features.length),
        features.length - 1
      )
      
      setActiveIndex(Math.max(0, index))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [features.length])

  return (
    <div ref={containerRef} className="relative pb-2" style={{ minHeight: `${features.length * 30}vh` }}>
      <div className="sticky top-20 h-[70vh] flex flex-col">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 flex-1 flex flex-col justify-center min-h-0">
          {/* Header */}
          <div className="text-center mb-8 flex-shrink-0">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Features
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your Science Olympiad team
            </p>
          </div>
          
          {/* Feature showcase */}
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-center flex-shrink-0">
            {/* Left: Feature List (Static - All visible) */}
            <div className="space-y-3">
              {features.map((feature, index) => {
                const isActive = index === activeIndex

                return (
                  <div
                    key={feature.title}
                    className={`transition-all duration-500 ${
                      isActive ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <h3
                      className={`font-heading text-xl md:text-2xl font-bold transition-colors duration-500 ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {feature.title}
                    </h3>
                  </div>
                )
              })}
            </div>

            {/* Right: Scroll-driven stacked images */}
            <div className="h-[400px] lg:h-[450px] mt-8">
              <div className="relative h-full rounded-3xl overflow-hidden bg-card dark:bg-slate-800 border-2 border-border shadow-2xl p-6 flex flex-col items-center justify-center">
                {features.map((feature, index) => {
                  const Icon = iconMap[feature.icon]
                  const isActive = index === activeIndex

                  return (
                    <div
                      key={feature.title}
                      className={`absolute inset-0 flex flex-col items-center justify-center p-6 transition-all duration-700 ${
                        isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                      }`}
                    >
                      <div className="relative mb-6 w-full">
                        {/* Large icon - wider and shorter */}
                        <div
                          className={`w-full h-36 md:h-44 rounded-3xl bg-teamy-primary/10 dark:bg-teamy-primary/20 flex items-center justify-center shadow-2xl animate-float`}
                        >
                          <Icon className="h-20 w-20 md:h-24 md:w-24 text-teamy-primary" strokeWidth={1.5} />
                        </div>
                        {/* Decorative rings */}
                        <div
                          className={`absolute inset-0 rounded-3xl border-4 border-teamy-primary/20 animate-pulse-slow`}
                          style={{ animationDelay: '0s' }}
                        />
                        <div
                          className={`absolute -inset-2 rounded-3xl border-2 border-teamy-primary/10 animate-pulse-slow`}
                          style={{ animationDelay: '0.5s' }}
                        />
                      </div>
                      
                      {/* Description */}
                      <div className="text-center max-w-md">
                        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
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
