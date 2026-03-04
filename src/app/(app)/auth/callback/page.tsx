import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPreferredClubPathForUser } from '@/lib/club-routing'
import { cookies } from 'next/headers'
import { resolveSafeCallbackPath } from '@/lib/url-safety'
import { prisma } from '@/lib/prisma'
import { hasAgeVerification } from '@/lib/age-verification'

async function getDefaultRedirect(userId: string) {
  const cookieStore = await cookies()
  const lastVisitedClub = cookieStore.get('lastVisitedClub')?.value

  return getPreferredClubPathForUser(userId, { lastVisitedClubId: lastVisitedClub })
}

type AuthCallbackPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string
    redirect?: string
  }>
}

export default async function AuthCallbackPage({ searchParams }: AuthCallbackPageProps) {
  const session = await getServerSession(authOptions)
  const resolvedSearchParams = await searchParams

  if (!session?.user) {
    // Not logged in, redirect to login
    redirect('/login')
  }

  const defaultRedirect = await getDefaultRedirect(session.user.id)
  const rawCallbackUrl = resolvedSearchParams?.callbackUrl ?? resolvedSearchParams?.redirect
  const destination = resolveSafeCallbackPath(rawCallbackUrl, defaultRedirect)

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  })

  if (!hasAgeVerification(user?.preferences)) {
    redirect(`/age-verification?${new URLSearchParams({ callbackUrl: destination }).toString()}`)
  }

  redirect(destination)
}
