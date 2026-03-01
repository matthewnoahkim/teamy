import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { verifyInviteCode } from '@/lib/invite-codes'
import { getPreferredClubIdForUser } from '@/lib/club-routing'

type JoinPageProps = {
  searchParams?: Promise<{
    code?: string
    inviteClub?: string
  }>
}

type InviteClubRecord = {
  id: string
  adminInviteCodeHash: string
  memberInviteCodeHash: string
}

async function getLoggedInUserClubRedirect(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const lastClubId = cookieStore.get('lastVisitedClub')?.value
  return getPreferredClubIdForUser(userId, { lastVisitedClubId: lastClubId })
}

async function resolveInviteClubId(code: string, preferredClubId?: string): Promise<string | null> {
  const verifyAgainstClub = async (club: InviteClubRecord | null): Promise<string | null> => {
    if (!club) return null

    const adminMatch = await verifyInviteCode(code, club.adminInviteCodeHash)
    if (adminMatch) return club.id

    const memberMatch = await verifyInviteCode(code, club.memberInviteCodeHash)
    if (memberMatch) return club.id

    return null
  }

  if (preferredClubId) {
    const preferredClub = await prisma.club.findUnique({
      where: { id: preferredClubId },
      select: {
        id: true,
        adminInviteCodeHash: true,
        memberInviteCodeHash: true,
      },
    })
    const directMatch = await verifyAgainstClub(preferredClub)
    if (directMatch) return directMatch
  }

  const clubs = await prisma.club.findMany({
    select: {
      id: true,
      adminInviteCodeHash: true,
      memberInviteCodeHash: true,
    },
  })

  for (const club of clubs) {
    const matchedClubId = await verifyAgainstClub(club)
    if (matchedClubId) return matchedClubId
  }

  return null
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
    const inviteClubId = await resolveInviteClubId(code, inviteClub || undefined)
    if (inviteClubId) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_clubId: {
            userId: session.user.id,
            clubId: inviteClubId,
          },
        },
        select: { id: true },
      })

      if (existingMembership) {
        redirect(`/club/${inviteClubId}`)
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
