import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TDPortalClient, type TournamentRequest } from '@/components/td-portal-client'
import { TDLoginClient } from '@/components/td-login-client'

export default async function TDPortalPage() {
  const session = await getServerSession(authOptions)

  // If not signed in, show login page
  if (!session?.user?.email) {
    return <TDLoginClient />
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

  // Combine requests and staff records, deduplicating by tournament ID
  const tournamentIds = new Set<string>()
  const allAccess: Array<{
    createdAt: Date
    updatedAt: Date
    tournament: { id: string; name: string; division: string; startDate: Date; endDate: Date } | null
    [key: string]: unknown
  }> = []

  // Add hosting requests
  for (const request of requests) {
    if (request.tournament && !tournamentIds.has(request.tournament.id)) {
      tournamentIds.add(request.tournament.id)
      allAccess.push(request)
    }
  }

  // Add staff records (convert to request-like format for the component)
  for (const staff of staffRecords) {
    if (staff.tournament && !tournamentIds.has(staff.tournament.id)) {
      tournamentIds.add(staff.tournament.id)
      // Create a request-like object for staff records
      // Use staff.id as a marker, but we'll need to handle routing differently
      allAccess.push({
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

  // If no access found, show unauthorized message
  if (allAccess.length === 0) {
    return <TDLoginClient unauthorized email={session.user.email} />
  }

  // Serialize dates for client component
  const serializedRequests = allAccess.map(request => ({
    ...request,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    tournament: request.tournament ? {
      ...request.tournament,
      startDate: request.tournament.startDate.toISOString(),
      endDate: request.tournament.endDate.toISOString(),
    } : null,
  }))

  return <TDPortalClient user={session.user} requests={serializedRequests as TournamentRequest[]} />
}

