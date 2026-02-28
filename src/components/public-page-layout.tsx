import Link from 'next/link'
import { Logo } from '@/components/logo'
import { HomeNav } from '@/components/home-nav'
import { DiscordBanner } from '@/components/discord-banner'
import { PublicPageTransition } from '@/components/public-page-transition'
import { PublicPageTools } from '@/components/public-page-tools'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

interface PublicPageLayoutProps {
  children: React.ReactNode
  hideFooter?: boolean
}

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

export async function PublicPageLayout({ children, hideFooter = false }: PublicPageLayoutProps) {
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10002] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Discord Banner */}
      <DiscordBanner initialSettings={bannerSettings} />
      
      {/* Header */}
      <header className="floating-bar-shell floating-bar-shell-top" suppressHydrationWarning>
        <div className="container mx-auto floating-bar-content px-4 sm:px-6 flex items-center justify-between gap-2">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 flex-shrink-0">
            <HomeNav 
              variant="light" 
              mobileButton={
                isLoggedIn ? (
                  <Link
                    href={loggedInRedirect}
                    className="block w-full rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-teamy-primary shadow-sm transition-all duration-200 hover:bg-white/90 hover:shadow-md"
                  >
                    My Clubs
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <Link
                      href="/login"
                      className="block w-full rounded-full border border-white/40 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-white/10"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      className="block w-full rounded-full bg-white px-4 py-2.5 text-center text-sm font-semibold text-teamy-primary shadow-sm transition-all duration-200 hover:bg-white/90 hover:shadow-md"
                    >
                      Sign Up
                    </Link>
                  </div>
                )
              }
            />
            {isLoggedIn ? (
              <Link
                href={loggedInRedirect}
                className="hidden whitespace-nowrap rounded-full bg-white px-5 py-2 text-xs font-semibold text-teamy-primary shadow-sm transition-all duration-200 hover:bg-white/90 hover:shadow-md md:block md:px-6 md:py-2.5 md:text-sm"
              >
                My Clubs
              </Link>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link
                  href="/login"
                  className="whitespace-nowrap px-2 py-2 text-xs font-semibold text-white/90 transition-colors hover:text-white md:px-3 md:text-sm"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="block whitespace-nowrap rounded-full bg-white px-5 py-2 text-xs font-semibold text-teamy-primary shadow-sm transition-all duration-200 hover:bg-white/90 hover:shadow-md md:px-6 md:py-2.5 md:text-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 bg-background grid-pattern">
        <PublicPageTransition>{children}</PublicPageTransition>
      </main>

      {/* Footer */}
      {!hideFooter && (
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
      )}
    </div>
  )
}
