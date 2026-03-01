import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ESPortalClient, type StaffMembership } from '@/components/es-portal-client'
import { ESLoginClient } from '@/components/es-login-client'
import { Suspense } from 'react'
import { getESTestsForUser } from '@/lib/es-tests'

interface ESPortalPageProps {
  searchParams: Promise<{ token?: string; tournament?: string }>
}

interface InviteInfo {
  id: string
  email: string
  name: string | null
  role: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  tournament: {
    id: string
    name: string
    division: string
    startDate: Date
    endDate: Date
    hostingRequestId: string | null
  }
  events: Array<{
    event: {
      id: string
      name: string
    }
  }>
}

export default async function ESPortalPage({ searchParams }: ESPortalPageProps) {
  const { token, tournament } = await searchParams
  const session = await getServerSession(authOptions)

  // If there's a token, fetch invite info for display
  let inviteInfo: InviteInfo | null = null
  if (token) {
    const foundInvite = await prisma.tournamentStaff.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tournament: {
          select: {
            id: true,
            name: true,
            division: true,
            startDate: true,
            endDate: true,
            hostingRequestId: true,
          },
        },
        events: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })
    if (foundInvite) {
      inviteInfo = foundInvite as InviteInfo
    }
  }

  const serializeInviteInfo = async () => {
    if (!inviteInfo) return null

    let displayDivision: string | undefined = inviteInfo.tournament.division
    if (inviteInfo.tournament.hostingRequestId) {
      const hostingRequest = await prisma.tournamentHostingRequest.findUnique({
        where: { id: inviteInfo.tournament.hostingRequestId },
        select: { division: true },
      })
      if (hostingRequest?.division) {
        displayDivision = hostingRequest.division
      }
    }

    return {
      ...inviteInfo,
      tournament: {
        ...inviteInfo.tournament,
        division: displayDivision || inviteInfo.tournament.division,
        startDate: inviteInfo.tournament.startDate.toISOString(),
        endDate: inviteInfo.tournament.endDate.toISOString(),
      },
    }
  }

  // If not signed in, show login page with invite info if available
  if (!session?.user?.email) {
    const serializedInviteInfo = await serializeInviteInfo()
    return <ESLoginClient inviteInfo={serializedInviteInfo} token={token} />
  }

  // If there's a token, try to accept the invitation
  if (token && inviteInfo && inviteInfo.status === 'PENDING') {
    // Check if the email matches
    if (inviteInfo.email.toLowerCase() === session.user.email.toLowerCase()) {
      // Accept the invitation
      await prisma.tournamentStaff.update({
        where: { id: inviteInfo.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          userId: session.user.id,
          name: inviteInfo.name || session.user.name,
        },
      })
    }
  }

  // Build all ES/TD test access using the shared loader (single source of truth).
  const serializedStaffMemberships = await getESTestsForUser(
    session.user.id,
    session.user.email,
    { includeQuestions: true }
  )

  // If no memberships found, show unauthorized message
  if (serializedStaffMemberships.length === 0) {
    // Check if there's a pending invitation for this email
    const pendingInvite = await prisma.tournamentStaff.findFirst({
      where: {
        email: { equals: session.user.email, mode: 'insensitive' },
        status: 'PENDING',
      },
    })

    // If there's a pending invite that matches but wasn't auto-accepted (edge case), show appropriate message
    if (pendingInvite && pendingInvite.inviteToken === token) {
      const serializedInviteInfo = await serializeInviteInfo()
      return <ESLoginClient unauthorized email={session.user.email} inviteInfo={serializedInviteInfo} token={token} />
    }

    return <ESLoginClient unauthorized email={session.user.email} />
  }

  // Prefetch timelines server-side so the first paint isn't empty.
  const tournamentIds = Array.from(
    new Set(serializedStaffMemberships.map((membership) => membership.tournament.id))
  )
  const timelineItems = tournamentIds.length
    ? await prisma.tournamentTimeline.findMany({
        where: {
          tournamentId: {
            in: tournamentIds,
          },
        },
        select: {
          id: true,
          tournamentId: true,
          name: true,
          description: true,
          dueDate: true,
          type: true,
        },
        orderBy: [
          { tournamentId: 'asc' },
          { dueDate: 'asc' },
        ],
      })
    : []

  const timelineByTournament = timelineItems.reduce<Record<string, Array<{
    id: string
    name: string
    description: string | null
    dueDate: string
    type: string
  }>>>((acc, item) => {
    if (!acc[item.tournamentId]) {
      acc[item.tournamentId] = []
    }
    acc[item.tournamentId].push({
      id: item.id,
      name: item.name,
      description: item.description,
      dueDate: item.dueDate.toISOString(),
      type: item.type,
    })
    return acc
  }, {})

  const initialTimelines = Object.fromEntries(
    tournamentIds.map((tournamentId) => [tournamentId, timelineByTournament[tournamentId] ?? []])
  )

  return (
    <Suspense fallback={<div className="min-h-screen bg-background grid-pattern" />}>
      <ESPortalClient 
        user={session.user} 
        staffMemberships={serializedStaffMemberships as unknown as StaffMembership[]} 
        initialTimelines={initialTimelines}
        initialTournamentId={tournament || null}
      />
    </Suspense>
  )
}
