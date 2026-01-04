import Link from 'next/link'
import { Logo } from '@/components/logo'
import { HomeNav } from '@/components/home-nav'
import { DiscordBanner } from '@/components/discord-banner'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface PublicPageLayoutProps {
  children: React.ReactNode
  hideFooter?: boolean
}

export async function PublicPageLayout({ children, hideFooter = false }: PublicPageLayoutProps) {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Discord Banner */}
      <DiscordBanner />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-teamy-primary dark:bg-slate-900 shadow-nav" suppressHydrationWarning>
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 overflow-x-auto">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 flex-shrink-0">
            <HomeNav 
              variant="light" 
              mobileButton={
                <Link href={isLoggedIn ? "/dashboard" : "/login"}>
                  <button className="w-full px-4 py-2.5 text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors shadow-sm">
                    {isLoggedIn ? "Dashboard" : "Sign In"}
                  </button>
                </Link>
              }
            />
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="hidden md:block">
              <button className="px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors whitespace-nowrap shadow-sm">
                {isLoggedIn ? "Dashboard" : "Sign In"}
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 dark:bg-slate-900 grid-pattern">
        {children}
      </main>

      {/* Footer */}
      {!hideFooter && (
        <footer className="border-t border-border bg-card py-4">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
              <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
                <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
                <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

