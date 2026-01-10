import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { TDTournamentManageClient } from '@/components/td-tournament-manage-client'
import { hasESAccess } from '@/lib/rbac'

interface Props {
  params: Promise<{ tournamentId: string }>
}

export default async function TournamentManagePage({ params }: Props) {
  const { tournamentId } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/td')
  }

  // Verify the user has access to this tournament (TD or ES)
  const hasAccess = await hasESAccess(session.user.id, session.user.email, tournamentId)
  
  if (!hasAccess) {
    notFound()
  }

  // Get tournament data
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      hostingRequest: {
        select: {
          division: true,
          tournamentLevel: true,
        },
      },
    },
  })
  
  if (!tournament) {
    notFound()
  }

  // Fetch staff for this tournament
  const staff = await prisma.tournamentStaff.findMany({
    where: {
      tournamentId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
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
      },
      tests: {
        select: {
          id: true,
          name: true,
          status: true,
          eventId: true,
        },
      },
    },
    orderBy: {
      invitedAt: 'asc',
    },
  })

  // Fetch timeline items
  const timeline = await prisma.tournamentTimeline.findMany({
    where: {
      tournamentId,
    },
    orderBy: {
      dueDate: 'asc',
    },
  })

  // Fetch hosting request if tournament has one
  const hostingRequest = tournament.hostingRequestId
    ? await prisma.tournamentHostingRequest.findUnique({
        where: { id: tournament.hostingRequestId },
      })
    : null

  // Get display division from hosting request (supports "B&C"), fallback to tournament division
  const displayDivision = tournament.hostingRequest?.division || tournament.division

  // Parse eventsRun to get list of event IDs being run in this tournament
  let eventsRunIds: string[] = []
  if (tournament.eventsRun && tournament.eventsRun.trim()) {
    try {
      const parsed = JSON.parse(tournament.eventsRun)
      eventsRunIds = Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.error('Error parsing eventsRun:', e)
    }
  }

  // Fetch events for this division - handle B&C tournaments
  // Only fetch events that are being run in this tournament
  let events
  if (displayDivision === 'B&C' || (typeof displayDivision === 'string' && displayDivision.includes('B') && displayDivision.includes('C'))) {
    // For B&C tournaments, fetch both B and C events
    const [bEvents, cEvents] = await Promise.all([
      prisma.event.findMany({
        where: { 
          division: 'B',
          ...(eventsRunIds.length > 0 && { id: { in: eventsRunIds } }),
        },
        select: { id: true, name: true, division: true },
        orderBy: { name: 'asc' },
      }),
      prisma.event.findMany({
        where: { 
          division: 'C',
          ...(eventsRunIds.length > 0 && { id: { in: eventsRunIds } }),
        },
        select: { id: true, name: true, division: true },
        orderBy: { name: 'asc' },
      }),
    ])
    // Combine and deduplicate by slug (though there shouldn't be duplicates)
    events = [...bEvents, ...cEvents].sort((a, b) => a.name.localeCompare(b.name))
  } else {
    // For single division tournaments
    events = await prisma.event.findMany({
      where: {
        division: tournament.division,
        ...(eventsRunIds.length > 0 && { id: { in: eventsRunIds } }),
      },
      select: {
        id: true,
        name: true,
        division: true,
      },
      orderBy: {
        name: 'asc',
      },
    })
  }

  // Serialize dates for client component
  const serializedTournament = {
    id: tournament.id,
    name: tournament.name,
    slug: tournament.slug,
    division: displayDivision, // Use hosting request division for display if available
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
    startTime: tournament.startTime.toISOString(),
    endTime: tournament.endTime.toISOString(),
    location: tournament.location,
    description: tournament.description,
    isOnline: tournament.isOnline,
    price: tournament.price,
    additionalTeamPrice: tournament.additionalTeamPrice,
    feeStructure: tournament.feeStructure,
    registrationStartDate: tournament.registrationStartDate?.toISOString() || null,
    registrationEndDate: tournament.registrationEndDate?.toISOString() || null,
    earlyBirdDiscount: tournament.earlyBirdDiscount,
    earlyBirdDeadline: tournament.earlyBirdDeadline?.toISOString() || null,
    lateFee: tournament.lateFee,
    lateFeeStartDate: tournament.lateFeeStartDate?.toISOString() || null,
    otherDiscounts: tournament.otherDiscounts,
    eligibilityRequirements: tournament.eligibilityRequirements,
    eventsRun: tournament.eventsRun,
    trialEvents: tournament.trialEvents,
    level: tournament.hostingRequest?.tournamentLevel || null,
    published: tournament.published,
  }

  const serializedStaff = staff.map(s => ({
    ...s,
    invitedAt: s.invitedAt.toISOString(),
    acceptedAt: s.acceptedAt?.toISOString() || null,
    trialEvents: s.trialEvents,
  }))

  const serializedTimeline = timeline.map(t => ({
    ...t,
    dueDate: t.dueDate.toISOString(),
  }))

  return (
    <TDTournamentManageClient
      user={session.user}
      tournament={serializedTournament}
      initialStaff={serializedStaff}
      initialTimeline={serializedTimeline}
      events={events}
    />
  )
}

