'use client'

import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { ScrollAnimate } from '@/components/scroll-animate'
import { Typewriter } from '@/components/ui/typewriter'

interface HomeHeroProps {
  isLoggedIn: boolean
}

export function HomeHero({ isLoggedIn }: HomeHeroProps) {
  return (
    <section className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16 bg-background grid-pattern min-h-0 overflow-y-auto">
      <div className="w-full mx-auto text-center space-y-4 sm:space-y-5">
        {/* Badge */}
        <ScrollAnimate animation="elegant" delay={0} duration={800}>
          <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-teamy-primary/10 dark:bg-teamy-primary/20 border border-teamy-primary/20">
            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-teamy-primary" />
            <span className="text-xs sm:text-sm font-semibold text-teamy-primary">Built for Science Olympiad</span>
          </div>
        </ScrollAnimate>

        {/* Main heading */}
        <ScrollAnimate animation="elegant" delay={100} duration={900}>
          <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-none text-foreground">
            Teamy
          </h1>
        </ScrollAnimate>

        {/* Tagline with Typewriter */}
        <ScrollAnimate animation="elegant" delay={200} duration={900}>
          <div className="text-lg sm:text-xl md:text-2xl text-muted-foreground font-medium max-w-4xl mx-auto leading-relaxed px-4 min-h-[80px] flex items-center justify-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <span>The complete platform for team</span>
              <Typewriter
                  text={[
                    "communication",
                    "organization",
                    "planning",
                    "management",
                  ]}
                  speed={60}
                  className="text-teamy-primary dark:text-teamy-accent font-semibold"
                  waitTime={2000}
                  deleteSpeed={40}
                cursorChar="|"
              />
            </div>
          </div>
        </ScrollAnimate>

        {/* CTA Buttons */}
        <ScrollAnimate animation="bounce-in" delay={300} duration={800}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-4 px-4 max-w-2xl mx-auto">
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="w-full sm:w-auto">
              <button className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold bg-teamy-primary text-white rounded-full shadow-lg hover:bg-teamy-primary-dark hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2">
                {isLoggedIn ? "Go to Dashboard" : "Get started today"}
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/features" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-foreground border-2 border-border hover:border-teamy-primary/50 hover:bg-teamy-primary/5 rounded-full transition-all duration-300">
                View Features
              </button>
            </Link>
          </div>
        </ScrollAnimate>

        {/* Demo Video */}
        <ScrollAnimate animation="fade-scale" delay={500} duration={800}>
          <div className="pt-8 px-4 w-full max-w-6xl mx-auto">
            <div className="rounded-2xl border-2 border-teamy-primary/20 bg-card p-8 text-center w-full">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teamy-primary/10 text-teamy-primary font-semibold">
                DEMO VIDEO COMING SOON
              </div>
            </div>
          </div>
        </ScrollAnimate>
      </div>
    </section>
  )
}

