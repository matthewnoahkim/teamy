import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { HomeNav } from '@/components/home-nav'
import { DiscordBanner } from '@/components/discord-banner'
import { ScrollAnimate } from '@/components/scroll-animate'
import { HomeHero } from '@/components/home-hero'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

async function getBannerSettings() {
  try {
    const [enabledSetting, textSetting, linkSetting, bgSetting] = await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: 'banner_enabled' } }),
      prisma.siteSetting.findUnique({ where: { key: 'banner_text' } }),
      prisma.siteSetting.findUnique({ where: { key: 'banner_link' } }),
      prisma.siteSetting.findUnique({ where: { key: 'banner_background_color' } }),
    ])

    return {
      enabled: enabledSetting?.value === 'true',
      text: textSetting?.value || 'This website is still a work in progress! Please report any issues to teamysite@gmail.com',
      link: linkSetting?.value || '',
      backgroundColor: bgSetting?.value || '#8B5CF6',
    }
  } catch (error) {
    console.error('Failed to fetch banner settings:', error)
    return {
      enabled: true,
      text: 'This website is still a work in progress! Please report any issues to teamysite@gmail.com',
      link: '',
      backgroundColor: '#8B5CF6',
    }
  }
}

async function getLoggedInUserRedirect(userId: string): Promise<string> {
  try {
    // Get user's clubs
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: {
        club: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // If no clubs, go to no-clubs page
    if (memberships.length === 0) {
      return '/no-clubs'
    }

    // Try to get last visited club from cookie
    const cookieStore = await cookies()
    const lastClubId = cookieStore.get('lastVisitedClub')?.value

    // If there's a last visited club and user is still a member, redirect there
    if (lastClubId && memberships.some(m => m.club.id === lastClubId)) {
      return `/club/${lastClubId}`
    }

    // Otherwise redirect to the first club (most recently joined)
    return `/club/${memberships[0].club.id}`
  } catch (error) {
    console.error('Error getting user redirect:', error)
    return '/no-clubs'
  }
}

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user
  const bannerSettings = await getBannerSettings()
  
  // Get the appropriate redirect URL for logged-in users
  const loggedInRedirect = isLoggedIn && session?.user?.id 
    ? await getLoggedInUserRedirect(session.user.id)
    : '/login'

  return (
    <div className="min-h-screen flex flex-col bg-background grid-pattern text-foreground">
      {/* Discord Banner */}
      <DiscordBanner initialSettings={bannerSettings} />
      
      {/* Header */}
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 overflow-x-auto">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 flex-shrink-0">
            <HomeNav 
              variant="light" 
              mobileButton={
                <Link href={isLoggedIn ? loggedInRedirect : "/login"}>
                  <button className="w-full px-4 py-2.5 text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors shadow-sm">
                    {isLoggedIn ? "My Clubs" : "Sign In"}
                  </button>
                </Link>
              }
            />
            <Link href={isLoggedIn ? loggedInRedirect : "/login"} className="hidden md:block">
              <button className="px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors whitespace-nowrap shadow-sm">
                {isLoggedIn ? "My Clubs" : "Sign In"}
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Takes remaining height */}
      <HomeHero isLoggedIn={isLoggedIn} loggedInRedirect={loggedInRedirect} />

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-xs sm:text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
              <p className="text-xs text-muted-foreground font-medium">FERPA and COPPA compliant</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
