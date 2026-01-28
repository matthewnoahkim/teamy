import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { Role } from '@prisma/client'
import { TDTournamentManageClient } from '@/components/td-tournament-manage-client'

interface Props {
  params: Promise<{ requestId: string }>
}

export default async function TournamentManageByRequestPage({ params }: Props) {
  const resolvedParams = await params
  const { requestId } = resolvedParams
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/td')
  }

  // Fetch the hosting request and verify ownership
  const request = await prisma.tournamentHostingRequest.findFirst({
    where: {
      id: requestId,
      directorEmail: {
        equals: session.user.email,
        mode: 'insensitive',
      },
      status: 'APPROVED',
    },
    include: {
      tournament: true,
    },
  })

  if (!request) {
    notFound()
  }

  // If no tournament exists, create one
  let tournament = request.tournament
  if (!tournament) {
    // Generate a slug from the tournament name
    const baseSlug = request.preferredSlug || 
      request.tournamentName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    
    // Ensure slug is unique
    let slug = baseSlug
    let counter = 1
    while (await prisma.tournament.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Determine division - handle "B&C" case
    // For "B&C" tournaments, store as 'C' in database but we'll display from hosting request
    let division: 'B' | 'C' = 'C'
    if (request.division === 'B') {
      division = 'B'
    } else if (request.division === 'C') {
      division = 'C'
    } else if (request.division.includes('B') && request.division.includes('C')) {
      // For "B&C", default to 'C' but we'll track the original in hostingRequest
      division = 'C'
    }

    // Create the tournament and add director as admin
    tournament = await prisma.tournament.create({
      data: {
        name: request.tournamentName,
        slug,
        division,
        description: request.otherNotes,
        isOnline: request.tournamentFormat === 'satellite',
        startDate: new Date(),
        endDate: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        location: request.location,
        approved: true,
        createdById: session.user.id,
        hostingRequestId: requestId,
      },
    })

    // Ensure the director (current user) is added as a tournament admin
    // This ensures they can see the tournament in the dev panel
    await prisma.tournamentAdmin.upsert({
      where: {
        tournamentId_userId: {
          tournamentId: tournament.id,
          userId: session.user.id,
        },
      },
      create: {
        tournamentId: tournament.id,
        userId: session.user.id,
      },
      update: {},
    })
  }

  // Fetch staff for this tournament
  const staff = await prisma.tournamentStaff.findMany({
    where: {
      tournamentId: tournament.id,
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
        orderBy: {
          event: {
            name: 'asc',
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
      tournamentId: tournament.id,
    },
    orderBy: {
      dueDate: 'asc',
    },
  })

  // Serialize dates for client component
  // Use hosting request division for display (supports "B&C"), but fallback to tournament division
  const displayDivision = request.division || tournament.division

  // Fetch registrations for this tournament
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId: tournament.id,
    },
    include: {
      club: {
        select: {
          id: true,
          name: true,
          division: true,
          memberships: {
            where: {
              role: Role.ADMIN,
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
            },
          },
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      },
      registeredBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

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
  const serializedTournament = {
    id: tournament.id,
    name: tournament.name,
    slug: tournament.slug,
    division: displayDivision, // Use hosting request division for display
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
    published: tournament.published,
    level: request.tournamentLevel || null,
  }

  const serializedStaff = staff.map(s => ({
    ...s,
    invitedAt: s.invitedAt.toISOString(),
    acceptedAt: s.acceptedAt?.toISOString() || null,
  }))

  const serializedTimeline = timeline.map(t => ({
    ...t,
    dueDate: t.dueDate.toISOString(),
  }))

  const serializedRegistrations = registrations.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <TDTournamentManageClient
      user={session.user}
      tournament={serializedTournament}
      initialStaff={serializedStaff}
      initialTimeline={serializedTimeline}
      events={events}
      initialRegistrations={serializedRegistrations}
    />
  )
}

