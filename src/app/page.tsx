import { getServerSession } from 'next/auth'
import { authOptions } from '@/lib/auth'
import { ArrowRight, Sparkles, Users, Trophy, Calendar, Zap } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { HomeNav } from '@/components/home-nav'
import { ScrollAnimate } from '@/components/scroll-animate'
import { AnimatedGradient } from '@/components/animated-gradient'
import { FeatureCard } from '@/components/feature-card'

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user

  const features = [
    {
      icon: Users,
      title: 'Team Management',
      description: 'Organize clubs, teams, and rosters with powerful admin tools',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Trophy,
      title: 'Tournaments',
      description: 'Host and manage Science Olympiad tournaments seamlessly',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Calendar,
      title: 'Events & Calendar',
      description: 'Schedule practices, meetings, and track attendance',
      color: 'from-amber-500 to-orange-500'
    },
    {
      icon: Zap,
      title: 'Testing Portal',
      description: 'Create and grade tests with AI-powered assistance',
      color: 'from-green-500 to-emerald-500'
    }
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      {/* Animated background gradient */}
      <AnimatedGradient />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-teamy-primary/95 dark:bg-slate-900/95 backdrop-blur-lg shadow-nav">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 overflow-x-auto">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 flex-shrink-0">
            <HomeNav 
              variant="light" 
              mobileButton={
                <Link href={isLoggedIn ? "/dashboard" : "/login"}>
                  <button className="w-full px-4 py-2.5 text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105">
                    {isLoggedIn ? "Dashboard" : "Sign In"}
                  </button>
                </Link>
              }
            />
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="hidden md:block">
              <button className="px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-all duration-300 whitespace-nowrap shadow-sm hover:shadow-md hover:scale-105">
                {isLoggedIn ? "Dashboard" : "Sign In"}
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 sm:py-16 relative min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-8 relative z-10">
          {/* Badge with shine effect */}
          <ScrollAnimate animation="elegant" delay={0} duration={800}>
            <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-teamy-primary/10 dark:bg-teamy-primary/20 border border-teamy-primary/20 backdrop-blur-sm hover:scale-105 transition-transform duration-300 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-teamy-primary animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold text-teamy-primary relative z-10">Built for Science Olympiad</span>
            </div>
          </ScrollAnimate>

          {/* Main heading with gradient */}
          <ScrollAnimate animation="elegant" delay={100} duration={900}>
            <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-none">
              <span className="bg-gradient-to-r from-teamy-primary via-teamy-accent to-teamy-primary bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                Teamy
              </span>
            </h1>
          </ScrollAnimate>

          {/* Tagline */}
          <ScrollAnimate animation="elegant" delay={200} duration={900}>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed px-4">
              The complete platform for managing your Science Olympiad team
            </p>
          </ScrollAnimate>

          {/* CTA Buttons */}
          <ScrollAnimate animation="bounce-in" delay={300} duration={800}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-4 px-4">
              <Link href={isLoggedIn ? "/dashboard" : "/login"} className="w-full sm:w-auto">
                <button className="group relative w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold bg-teamy-primary text-white rounded-full shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-teamy-primary-dark to-teamy-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoggedIn ? "Go to Dashboard" : "Get started today"}
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </Link>
              <Link href="/features" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-foreground border-2 border-border hover:border-teamy-primary hover:bg-teamy-primary/5 rounded-full transition-all duration-300 hover:scale-105 backdrop-blur-sm">
                  View Features
                </button>
              </Link>
            </div>
          </ScrollAnimate>

          {/* Feature Cards Grid */}
          <ScrollAnimate animation="fade-scale" delay={400} duration={800}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-12 px-4">
              {features.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  color={feature.color}
                  delay={index * 100}
                />
              ))}
            </div>
          </ScrollAnimate>

          {/* Demo Video */}
          <ScrollAnimate animation="fade-scale" delay={500} duration={800}>
            <div className="pt-8 px-4 max-w-3xl mx-auto">
              <div className="group rounded-2xl border-2 border-teamy-primary/20 bg-card/50 backdrop-blur-sm p-8 text-center hover:border-teamy-primary/40 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-teamy-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teamy-primary/10 text-teamy-primary font-semibold">
                  <div className="w-2 h-2 bg-teamy-primary rounded-full animate-pulse" />
                  DEMO VIDEO COMING SOON
                </div>
              </div>
            </div>
          </ScrollAnimate>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 backdrop-blur-sm py-4 relative z-10">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors hover:scale-105 duration-200">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors hover:scale-105 duration-200">Privacy</Link>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
