import { prisma } from '@/lib/prisma'
import { TDPortalClient, type TournamentRequest } from '@/components/td-portal-client'
import { TDLoginClient } from '@/components/td-login-client'
import { serverSession } from '@/lib/server-session'

interface TDPortalPageProps {
  searchParams: Promise<{ token?: string }>
}

interface InviteInfo {
  id: string
  email: string
  name: string | null
  role: 'TOURNAMENT_DIRECTOR'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  tournament: {
    id: string
    name: string
    division: string
    startDate: Date
    endDate: Date
    hostingRequestId: string | null
  }
}

export default async function TDPortalPage({ searchParams }: TDPortalPageProps) {
  const { token } = await searchParams
  const session = await serverSession.get()

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
      },
    })

    if (foundInvite?.role === 'TOURNAMENT_DIRECTOR') {
      inviteInfo = foundInvite as InviteInfo
    }
  }

  const serializeInviteInfo = async () => {
    if (!inviteInfo) return null

    let displayDivision = inviteInfo.tournament.division
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
        division: displayDivision,
        startDate: inviteInfo.tournament.startDate.toISOString(),
        endDate: inviteInfo.tournament.endDate.toISOString(),
      },
    }
  }

  // If not signed in, show login page
  if (!session?.user?.email) {
    const serializedInviteInfo = await serializeInviteInfo()
    return <TDLoginClient inviteInfo={serializedInviteInfo} token={token} />
  }

  if (
    token &&
    inviteInfo &&
    inviteInfo.status === 'PENDING' &&
    inviteInfo.email.toLowerCase() === session.user.email.toLowerCase()
  ) {
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

  if (
    token &&
    inviteInfo &&
    inviteInfo.email.toLowerCase() !== session.user.email.toLowerCase()
  ) {
    const serializedInviteInfo = await serializeInviteInfo()
    return <TDLoginClient unauthorized email={session.user.email} inviteInfo={serializedInviteInfo} token={token} />
  }

  // Check if the user's email has a tournament hosting request
  const requests = await prisma.tournamentHostingRequest.findMany({
    where: {
      directorEmail: {
        equals: session.user.email,
        mode: 'insensitive',
      },
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          division: true,
          startDate: true,
          endDate: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Also check if the user is a TD via TournamentStaff (for users upgraded to TD)
  const staffRecords = await prisma.tournamentStaff.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        {
          email: {
            equals: session.user.email,
            mode: 'insensitive',
          },
        },
      ],
      role: 'TOURNAMENT_DIRECTOR',
      status: 'ACCEPTED', // Only include accepted staff
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          division: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  })

  if (requests.length === 0 && staffRecords.length === 0) {
    const serializedInviteInfo = await serializeInviteInfo()
    return <TDLoginClient unauthorized email={session.user.email} inviteInfo={serializedInviteInfo} token={token} />
  }

  // Combine accessible tournaments from the user's requests and accepted TD invites.
  const tournamentIds = new Set<string>()
  const accessibleTournaments: Array<{
    createdAt: Date
    updatedAt: Date
    tournament: { id: string; name: string; division: string; startDate: Date; endDate: Date } | null
    [key: string]: unknown
  }> = []

  // Add all hosting requests so users can access TD portal immediately
  // after submitting (even before a tournament record exists).
  for (const request of requests) {
    accessibleTournaments.push(request)

    if (request.tournament) {
      tournamentIds.add(request.tournament.id)
    }
  }

  // Add staff records (convert to request-like format for the component)
  for (const staff of staffRecords) {
    if (staff.tournament && !tournamentIds.has(staff.tournament.id)) {
      tournamentIds.add(staff.tournament.id)
      accessibleTournaments.push({
        id: `staff-${staff.id}`, // Prefix to identify staff records
        tournamentId: staff.tournament.id,
        tournamentName: staff.tournament.name,
        tournamentLevel: 'invitational', // Default value
        division: staff.tournament.division,
        tournamentFormat: 'in-person', // Default value
        location: null,
        directorName: staff.name || session.user.name || '',
        directorEmail: staff.email,
        directorPhone: null,
        otherNotes: null,
        status: 'APPROVED' as const, // Staff records are always approved
        reviewNotes: null,
        tournament: staff.tournament,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt,
      })
    }
  }

  const serializeRecords = (records: Array<{
    createdAt: Date
    updatedAt: Date
    tournament: { id: string; name: string; division: string; startDate: Date; endDate: Date } | null
    [key: string]: unknown
  }>) => records.map(request => ({
    ...request,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    tournament: request.tournament ? {
      ...request.tournament,
      startDate: request.tournament.startDate.toISOString(),
      endDate: request.tournament.endDate.toISOString(),
    } : null,
  }))

  const serializedRequests = serializeRecords(requests)
  const serializedAccessibleTournaments = serializeRecords(accessibleTournaments)

  return (
    <TDPortalClient
      user={session.user}
      requests={serializedRequests as unknown as TournamentRequest[]}
      accessibleTournaments={
        serializedAccessibleTournaments as unknown as TournamentRequest[]
      }
    />
  )
}
