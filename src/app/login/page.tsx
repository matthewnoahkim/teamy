import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SignInButton } from '@/components/signin-button'
import { SignUpButton } from '@/components/signup-button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { cn } from '@/lib/utils'

type AuthMode = 'signin' | 'signup'

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string
    redirect?: string
    mode?: string
  }>
}

async function getDefaultRedirect(userId: string) {
  // Check if user has any club memberships
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { club: true },
    orderBy: { createdAt: 'desc' }
  })

  if (memberships.length === 0) {
    return '/no-clubs'
  }

  // Check for last visited club cookie
  const cookieStore = await cookies()
  const lastVisitedClub = cookieStore.get('lastVisitedClub')?.value

  if (lastVisitedClub) {
    // Verify the user is still a member of this club
    const isMember = memberships.some(m => m.club.id === lastVisitedClub)
    if (isMember) {
      return `/club/${lastVisitedClub}`
    }
  }

  // Default to first club
  return `/club/${memberships[0].club.id}`
}

function resolveCallbackUrl(rawCallbackUrl?: string, defaultUrl?: string) {
  if (!rawCallbackUrl) {
    return defaultUrl || '/auth/callback'
  }

  if (rawCallbackUrl.startsWith('/')) {
    return rawCallbackUrl
  }

  try {
    const url = new URL(rawCallbackUrl)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString()
    }
  } catch {
    // Ignore parsing errors and fallback to default
  }

  return defaultUrl || '/auth/callback'
}

function resolveAuthMode(rawMode?: string): AuthMode {
  return rawMode === 'signup' ? 'signup' : 'signin'
}

function buildAuthPageHref(mode: AuthMode, callbackUrl?: string) {
  const params = new URLSearchParams()

  if (mode === 'signup') {
    params.set('mode', 'signup')
  }

  if (callbackUrl) {
    params.set('callbackUrl', callbackUrl)
  }

  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getServerSession(authOptions)
  const resolvedSearchParams = await searchParams
  const authMode = resolveAuthMode(resolvedSearchParams?.mode)
  const isSignUpMode = authMode === 'signup'
  // Accept both callbackUrl and legacy redirect query params.
  const rawCallbackUrl = resolvedSearchParams?.callbackUrl ?? resolvedSearchParams?.redirect
  const signInPageHref = buildAuthPageHref('signin', rawCallbackUrl)
  const signUpPageHref = buildAuthPageHref('signup', rawCallbackUrl)

  // Calculate callback URL for both logged-in and logged-out states
  let callbackUrl = '/auth/callback' // default redirect handler
  
  if (session?.user) {
    const defaultRedirect = await getDefaultRedirect(session.user.id)
    callbackUrl = resolveCallbackUrl(rawCallbackUrl, defaultRedirect)
    redirect(callbackUrl)
  } else {
    // For non-logged-in users, use the callback from query params or default to auth callback
    callbackUrl = resolveCallbackUrl(rawCallbackUrl, '/auth/callback')
  }

  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Header */}
      <header className="floating-bar-shell floating-bar-shell-top">
        <div className="container mx-auto floating-bar-content px-4 flex items-center justify-between">
          <Logo size="md" href="/" variant="light" />
        </div>
      </header>

      {/* Sign In Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto">
          <div className="space-y-8 rounded-2xl border border-border bg-card p-8 md:p-12 shadow-card">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <Logo size="lg" showText={false} />
              </div>
              <div className="space-y-2">
                <h2 className="font-heading text-3xl font-bold text-foreground">
                  {isSignUpMode ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="text-lg text-muted-foreground">
                  {isSignUpMode
                    ? 'Get started with Teamy in under a minute.'
                    : 'Sign in to access your teams and tournaments.'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
                <Link
                  href={signInPageHref}
                  className={cn(
                    'rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors',
                    isSignUpMode
                      ? 'text-muted-foreground hover:text-foreground'
                      : 'bg-card text-foreground shadow-sm'
                  )}
                >
                  Sign In
                </Link>
                <Link
                  href={signUpPageHref}
                  className={cn(
                    'rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors',
                    isSignUpMode
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sign Up
                </Link>
              </div>

              {isSignUpMode ? (
                <SignUpButton callbackUrl={callbackUrl} label="Continue with Google" />
              ) : (
                <SignInButton callbackUrl={callbackUrl} label="Continue with Google" />
              )}

              <p className="text-center text-sm text-muted-foreground">
                {isSignUpMode ? (
                  <>
                    Already have an account?{' '}
                    <Link href={signInPageHref} className="font-semibold text-teamy-primary dark:text-teamy-accent hover:underline">
                      Sign in
                    </Link>
                  </>
                ) : (
                  <>
                    New to Teamy?{' '}
                    <Link href={signUpPageHref} className="font-semibold text-teamy-primary dark:text-teamy-accent hover:underline">
                      Create an account
                    </Link>
                  </>
                )}
              </p>

              <div className="text-center text-sm text-muted-foreground">
                <p>
                  By continuing, you agree to our{' '}
                  <Link href="/terms" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                    Terms of Service
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-teamy-primary dark:text-teamy-accent hover:underline font-medium">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
