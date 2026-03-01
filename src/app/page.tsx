import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { HomeNav } from '@/components/home-nav'
import { DiscordBanner } from '@/components/discord-banner'
import { HomeHero } from '@/components/home-hero'
import { PublicPageTools } from '@/components/public-page-tools'
import { prisma } from '@/lib/prisma'
import { getPreferredClubPathForUser } from '@/lib/club-routing'
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
      text: textSetting?.value || 'Welcome to Teamy. Questions or feedback? teamysite@gmail.com',
      link: linkSetting?.value || '',
      backgroundColor: bgSetting?.value || '#0056C7',
    }
  } catch (error) {
    console.error('Failed to fetch banner settings:', error)
    return {
      enabled: false,
      text: 'Welcome to Teamy. Questions or feedback? teamysite@gmail.com',
      link: '',
      backgroundColor: '#0056C7',
    }
  }
}

async function getLoggedInUserRedirect(userId: string): Promise<string> {
  try {
    const cookieStore = await cookies()
    const lastClubId = cookieStore.get('lastVisitedClub')?.value

    return await getPreferredClubPathForUser(userId, { lastVisitedClubId: lastClubId })
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
      <PublicPageTools />
      {/* Discord Banner */}
      <DiscordBanner initialSettings={bannerSettings} />

      {/* Header */}
      <header className="floating-bar-shell floating-bar-shell-top">
        <div className="container mx-auto floating-bar-content px-4 sm:px-6 flex items-center justify-between gap-2 overflow-x-auto">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 flex-shrink-0">
            <HomeNav
              variant="light"
              mobileButton={
                isLoggedIn ? (
                  <Link href={loggedInRedirect}>
                    <button className="w-full px-4 py-2.5 text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors shadow-sm">
                      My Clubs
                    </button>
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <Link href="/login" className="block w-full">
                      <button className="w-full px-4 py-2.5 text-sm font-semibold border border-white/40 text-white rounded-full hover:bg-white/10 transition-colors shadow-sm">
                        Sign In
                      </button>
                    </Link>
                    <Link href="/signup" className="block w-full">
                      <button className="w-full px-4 py-2.5 text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors shadow-sm">
                        Sign Up
                      </button>
                    </Link>
                  </div>
                )
              }
            />
            {isLoggedIn ? (
              <Link href={loggedInRedirect} className="hidden md:block">
                <button className="px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors whitespace-nowrap shadow-sm">
                  My Clubs
                </button>
              </Link>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link href="/login">
                  <button className="px-2 md:px-3 py-2 text-xs md:text-sm font-semibold text-white/90 hover:text-white transition-colors whitespace-nowrap">
                    Sign In
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors whitespace-nowrap shadow-sm">
                    Sign Up
                  </button>
                </Link>
              </div>
            )}
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
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
