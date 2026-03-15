'use client'

import { ArrowRight, Sparkles, Users, Trophy, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { ScrollAnimate } from '@/components/scroll-animate'
import { Typewriter } from '@/components/ui/typewriter'

export function HomeHero() {
  return (
    <section className="flex-1 flex items-center justify-center px-4 sm:px-6 py-16 sm:py-24 bg-background grid-pattern min-h-0 overflow-y-auto">
      <div className="w-full max-w-3xl mx-auto text-center">
        {/* Badge */}
        <ScrollAnimate animation="elegant" delay={0} duration={800}>
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teamy-primary/10 dark:bg-teamy-primary/20 border border-teamy-primary/20">
            <Sparkles className="h-3.5 w-3.5 text-teamy-primary" />
            <span className="text-xs font-semibold tracking-wide text-teamy-primary">Built for Science Olympiad</span>
          </div>
        </ScrollAnimate>

        {/* Main heading */}
        <ScrollAnimate animation="elegant" delay={100} duration={900}>
          <h1 className="mb-5 font-heading text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight leading-none text-foreground">
            Teamy
          </h1>
        </ScrollAnimate>

        {/* Tagline with Typewriter */}
        <ScrollAnimate animation="elegant" delay={200} duration={900}>
          <div className="mb-4 text-xl sm:text-2xl text-muted-foreground font-medium leading-relaxed min-h-[36px] flex items-center justify-center gap-2 flex-wrap">
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
        </ScrollAnimate>

        {/* Supporting description */}
        <ScrollAnimate animation="elegant" delay={270} duration={900}>
          <p className="mb-8 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Manage rosters, coordinate tournaments, run practice tests, and keep your team aligned — all in one place.
          </p>
        </ScrollAnimate>

        {/* CTA Buttons */}
        <ScrollAnimate animation="bounce-in" delay={340} duration={800}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <button className="group w-full sm:w-auto px-7 py-3.5 text-base font-semibold bg-teamy-primary text-white rounded-full shadow-md hover:bg-teamy-primary-dark hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2">
                Get started today
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
            </Link>
            <Link href="/features">
              <button className="w-full sm:w-auto px-7 py-3.5 text-base font-semibold text-foreground border border-border hover:border-teamy-primary/40 hover:bg-teamy-primary/5 rounded-full transition-all duration-200">
                View Features
              </button>
            </Link>
          </div>
        </ScrollAnimate>

        {/* Feature highlights */}
        <ScrollAnimate animation="elegant" delay={440} duration={800}>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-teamy-primary/10 border border-teamy-primary/20 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-teamy-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Member management</p>
                <p className="text-xs text-muted-foreground mt-0.5">Rosters, roles, and event assignments</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-teamy-primary/10 border border-teamy-primary/20 flex items-center justify-center shrink-0">
                <Trophy className="h-4 w-4 text-teamy-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Tournament tools</p>
                <p className="text-xs text-muted-foreground mt-0.5">Registration, coordination, and results</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-teamy-primary/10 border border-teamy-primary/20 flex items-center justify-center shrink-0">
                <ClipboardList className="h-4 w-4 text-teamy-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Practice &amp; testing</p>
                <p className="text-xs text-muted-foreground mt-0.5">Schedule tests and track progress</p>
              </div>
            </div>
          </div>
        </ScrollAnimate>
      </div>
    </section>
  )
}
