import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { getPreferredClubIdForUser } from '@/lib/club-routing'

type JoinPageProps = {
  searchParams?: Promise<{
    code?: string
    inviteClub?: string
  }>
}

async function getLoggedInUserClubRedirect(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const lastClubId = cookieStore.get('lastVisitedClub')?.value
  return getPreferredClubIdForUser(userId, { lastVisitedClubId: lastClubId })
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const session = await getServerSession(authOptions)
  const resolvedSearchParams = await searchParams
  const code = resolvedSearchParams?.code?.toString() ?? ''
  const inviteClub = resolvedSearchParams?.inviteClub?.toString() ?? ''
  const inviteClubQuery = inviteClub ? `&inviteClub=${encodeURIComponent(inviteClub)}` : ''

  // If not logged in, redirect to login with callback to this page
  if (!session?.user) {
    const target = code
      ? `/join?code=${encodeURIComponent(code)}${inviteClubQuery}`
      : '/join'
    redirect(`/login?callbackUrl=${encodeURIComponent(target)}`)
  }

  const redirectClubId = await getLoggedInUserClubRedirect(session.user.id)

  // If logged in with clubs, redirect directly to a club page and open join dialog there.
  if (code) {
    if (inviteClub) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_clubId: {
            userId: session.user.id,
            clubId: inviteClub,
          },
        },
        select: { id: true },
      })

      if (existingMembership) {
        redirect(`/club/${inviteClub}`)
      }
    }

    if (redirectClubId) {
      redirect(`/club/${redirectClubId}?join=${encodeURIComponent(code)}${inviteClubQuery}`)
    }
    redirect(`/no-clubs?code=${encodeURIComponent(code)}${inviteClubQuery}`)
  }

  if (redirectClubId) {
    redirect(`/club/${redirectClubId}`)
  }

  redirect('/no-clubs')
}
