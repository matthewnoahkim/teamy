import { ArrowLeft } from 'lucide-react'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/logo'
import { AgeVerificationClient } from '@/components/age-verification-client'
import { authOptions } from '@/lib/auth'
import { hasAgeVerification, parseBirthMonth, parseBirthYear } from '@/lib/age-verification'
import { getPreferredClubPathForUser } from '@/lib/club-routing'
import { prisma } from '@/lib/prisma'
import { resolveSafeCallbackPath } from '@/lib/url-safety'
import { cookies } from 'next/headers'

type AgeVerificationPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string
    birthMonth?: string
    birthYear?: string
    parentConsent?: string
  }>
}

async function getDefaultRedirect(userId: string) {
  const cookieStore = await cookies()
  const lastVisitedClub = cookieStore.get('lastVisitedClub')?.value

  return getPreferredClubPathForUser(userId, { lastVisitedClubId: lastVisitedClub })
}

function normalizeVerificationCallbackPath(rawCallbackUrl: string | undefined): string {
  const fallback = '/auth/callback'
  const resolved = resolveSafeCallbackPath(rawCallbackUrl, fallback)
  return resolved.startsWith('/age-verification') ? fallback : resolved
}

export default async function AgeVerificationPage({ searchParams }: AgeVerificationPageProps) {
  const resolvedSearchParams = await searchParams
  const session = await getServerSession(authOptions)
  const callbackUrl = normalizeVerificationCallbackPath(resolvedSearchParams?.callbackUrl)
  const initialBirthMonth = parseBirthMonth(resolvedSearchParams?.birthMonth)
  const initialBirthYear = parseBirthYear(resolvedSearchParams?.birthYear)
  const initialParentConsent = resolvedSearchParams?.parentConsent === '1'

  if (session?.user?.id) {
    const [user, defaultRedirect] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
      }),
      getDefaultRedirect(session.user.id),
    ])

    if (hasAgeVerification(user?.preferences)) {
      const redirectPath = callbackUrl === '/auth/callback'
        ? defaultRedirect
        : callbackUrl
      redirect(redirectPath)
    }
  }

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <header className="floating-bar-shell floating-bar-shell-top">
        <div className="container mx-auto floating-bar-content px-4 flex items-center justify-between">
          <Logo size="md" href="/" variant="light" />
        </div>
      </header>

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-lg mx-auto">
          <div className="space-y-8 rounded-2xl border border-border bg-card p-8 md:p-12 shadow-card">
            <div className="text-center space-y-2">
              <h1 className="font-heading text-3xl font-bold text-foreground">
                Verify your age
              </h1>
              <p className="text-muted-foreground">
                Enter your birth month and birth year to continue.
              </p>
            </div>

            <AgeVerificationClient
              callbackUrl={callbackUrl}
              authenticated={Boolean(session?.user?.id)}
              email={session?.user?.email}
              initialBirthMonth={initialBirthMonth}
              initialBirthYear={initialBirthYear}
              initialParentConsent={initialParentConsent}
            />
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to sign up
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
