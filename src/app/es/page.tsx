import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ESPortalClient } from '@/components/es-portal-client'
import { ESLoginClient } from '@/components/es-login-client'
import { Suspense } from 'react'
import { Division } from '@prisma/client'
import { getESTestsForUser } from '@/lib/es-tests'

interface ESPortalPageProps {
  searchParams: Promise<{ token?: string; tournament?: string }>
}

export default async function ESPortalPage({ searchParams }: ESPortalPageProps) {
  const { token, tournament } = await searchParams
  const session = await getServerSession(authOptions)

  // If there's a token, fetch invite info for display
  let inviteInfo = null
  if (token) {
    inviteInfo = await prisma.tournamentStaff.findUnique({
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
  }

  // If not signed in, show login page with invite info if available
  if (!session?.user?.email) {
    // Get hosting request division for display if available (as string, since hosting request supports "B&C")
    let displayDivision: string | undefined = inviteInfo?.tournament?.division
    if (inviteInfo?.tournament?.hostingRequestId) {
      const hostingRequest = await prisma.tournamentHostingRequest.findUnique({
        where: { id: inviteInfo.tournament.hostingRequestId },
        select: { division: true },
      })
      if (hostingRequest?.division) {
        displayDivision = hostingRequest.division
      }
    }
    
    // Serialize dates to strings for client component
    const serializedInviteInfo = inviteInfo ? {
      ...inviteInfo,
      tournament: {
        ...inviteInfo.tournament,
        division: displayDivision || inviteInfo.tournament.division,
        startDate: inviteInfo.tournament.startDate.toISOString(),
        endDate: inviteInfo.tournament.endDate.toISOString(),
      },
    } : null
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

  // Check if the user has any staff memberships
  const staffMemberships = await prisma.tournamentStaff.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { email: { equals: session.user.email, mode: 'insensitive' } },
      ],
      status: 'ACCEPTED',
    },
    include: {
        tournament: {
          select: {
            id: true,
            name: true,
            division: true,
            startDate: true,
            hostingRequestId: true,
            slug: true,
            trialEvents: true,
            createdById: true,
          },
        },
        events: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                division: true,
              },
            },
          },
          orderBy: {
            event: {
              name: 'asc',
            },
          },
        },
      // Tests will be fetched separately via API organized by event
    },
    orderBy: {
      tournament: {
        startDate: 'asc',
      },
    },
  })

  // Also check for tournament directors via TournamentAdmin or createdById
  // These should also have access to the ES portal
  const tournamentAdmins = await prisma.tournamentAdmin.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          division: true,
          startDate: true,
          hostingRequestId: true,
          slug: true,
          trialEvents: true,
          createdById: true,
        },
      },
    },
  })

  const createdTournaments = await prisma.tournament.findMany({
    where: {
      createdById: session.user.id,
    },
    select: {
      id: true,
      name: true,
      division: true,
      startDate: true,
      hostingRequestId: true,
      slug: true,
      trialEvents: true,
      createdById: true,
    },
  })

  // Also check hosting requests where user is director
  const directorHostingRequests = await prisma.tournamentHostingRequest.findMany({
    where: {
      directorEmail: {
        equals: session.user.email,
        mode: 'insensitive',
      },
      status: 'APPROVED',
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          division: true,
          startDate: true,
          hostingRequestId: true,
          slug: true,
          trialEvents: true,
          createdById: true,
        },
      },
    },
  })

  // Combine all tournament access and create TournamentStaff-like records for TDs
  const tournamentIdsSet = new Set(staffMemberships.map(m => m.tournament.id))
  
  // Add tournaments where user is admin
  for (const admin of tournamentAdmins) {
    if (admin.tournament && !tournamentIdsSet.has(admin.tournament.id)) {
      tournamentIdsSet.add(admin.tournament.id)
      // Create a TournamentStaff-like record for TD access
      staffMemberships.push({
        id: `admin-${admin.id}`,
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: 'TOURNAMENT_DIRECTOR' as const,
        status: 'ACCEPTED' as const,
        tournamentId: admin.tournament.id,
        inviteToken: `admin-${admin.id}-${admin.tournament.id}`, // Required field
        invitedAt: new Date(),
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        trialEvents: null,
        tournament: admin.tournament,
        events: [],
      } as any)
    }
  }

  // Add tournaments created by user
  for (const tournament of createdTournaments) {
    if (!tournamentIdsSet.has(tournament.id)) {
      tournamentIdsSet.add(tournament.id)
      staffMemberships.push({
        id: `creator-${tournament.id}`,
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: 'TOURNAMENT_DIRECTOR' as const,
        status: 'ACCEPTED' as const,
        tournamentId: tournament.id,
        inviteToken: `creator-${tournament.id}`, // Required field
        invitedAt: new Date(),
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        trialEvents: null,
        tournament: tournament,
        events: [],
      } as any)
    }
  }

  // Add tournaments from hosting requests
  for (const request of directorHostingRequests) {
    if (request.tournament && !tournamentIdsSet.has(request.tournament.id)) {
      tournamentIdsSet.add(request.tournament.id)
      staffMemberships.push({
        id: `hosting-${request.id}`,
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: 'TOURNAMENT_DIRECTOR' as const,
        status: 'ACCEPTED' as const,
        tournamentId: request.tournament.id,
        inviteToken: `hosting-${request.id}`, // Required field
        invitedAt: new Date(),
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        trialEvents: null,
        tournament: request.tournament,
        events: [],
      } as any)
    }
  }

  // If no memberships found, show unauthorized message
  if (staffMemberships.length === 0) {
    // Check if there's a pending invitation for this email
    const pendingInvite = await prisma.tournamentStaff.findFirst({
      where: {
        email: { equals: session.user.email, mode: 'insensitive' },
        status: 'PENDING',
      },
    })

    // If there's a pending invite that matches but wasn't auto-accepted (edge case), show appropriate message
    if (pendingInvite && pendingInvite.inviteToken === token) {
      // Get hosting request division for display if available (as string, since hosting request supports "B&C")
      let displayDivision: string | undefined = inviteInfo?.tournament?.division
      if (inviteInfo?.tournament?.hostingRequestId) {
        const hostingRequest = await prisma.tournamentHostingRequest.findUnique({
          where: { id: inviteInfo.tournament.hostingRequestId },
          select: { division: true },
        })
        if (hostingRequest?.division) {
          displayDivision = hostingRequest.division
        }
      }
      
      // The email didn't match but there's an invite - redirect to correct flow
      // Serialize dates to strings for client component
      const serializedInviteInfo = inviteInfo ? {
        ...inviteInfo,
        tournament: {
          ...inviteInfo.tournament,
          division: displayDivision || inviteInfo.tournament.division,
          startDate: inviteInfo.tournament.startDate.toISOString(),
          endDate: inviteInfo.tournament.endDate.toISOString(),
        },
      } : null
      return <ESLoginClient unauthorized email={session.user.email} inviteInfo={serializedInviteInfo} token={token} />
    }

    return <ESLoginClient unauthorized email={session.user.email} />
  }

  // Prefetch timelines server-side so the first paint isn't empty
  const timelineEntries = await Promise.all(
    staffMemberships.map(async membership => {
      const items = await prisma.tournamentTimeline.findMany({
        where: { tournamentId: membership.tournament.id },
        orderBy: { dueDate: 'asc' },
      })
      return [membership.tournament.id, items] as const
    })
  )

  const initialTimelines = Object.fromEntries(
    timelineEntries.map(([tournamentId, items]) => [
      tournamentId,
      items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        dueDate: item.dueDate.toISOString(),
        type: item.type,
      })),
    ])
  )

  // Prefetch tests server-side using shared function
  const serializedStaffMemberships = await getESTestsForUser(
    session.user.id,
    session.user.email,
    { includeQuestions: true } // Include questions for server-side rendering
  )

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern" />}>
      <ESPortalClient 
        user={session.user} 
        staffMemberships={serializedStaffMemberships} 
        initialTimelines={initialTimelines}
        initialTournamentId={tournament || null}
      />
    </Suspense>
  )
}

