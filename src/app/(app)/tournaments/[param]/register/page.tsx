import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TournamentRegistrationClient } from '@/components/tournament-registration-client'
import { Division } from '@prisma/client'

interface PageProps {
  params: Promise<{ param: string }>
}

export default async function TournamentRegistrationPage({ params }: PageProps) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)
  const { param } = resolvedParams

  // Find tournament by slug or ID
  let tournament = await prisma.tournament.findFirst({
    where: {
      OR: [
        { slug: param },
        { id: param },
      ],
    },
    include: {
      registrations: {
        include: {
          club: {
            select: {
              id: true,
              name: true,
              division: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
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
      },
      hostingRequest: {
        select: {
          id: true,
          tournamentName: true,
          division: true,
          directorName: true,
          directorEmail: true,
        },
      },
    },
  })

  // If not found by direct lookup, try finding via hosting request
  if (!tournament) {
    const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
      where: {
        OR: [
          { preferredSlug: param },
          { id: param },
        ],
        status: 'APPROVED',
      },
      include: {
        tournament: {
          include: {
            registrations: {
              include: {
                club: {
                  select: {
                    id: true,
                    name: true,
                    division: true,
                  },
                },
                team: {
                  select: {
                    id: true,
                    name: true,
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
            },
            hostingRequest: {
              select: {
                id: true,
                tournamentName: true,
                division: true,
                directorName: true,
                directorEmail: true,
              },
            },
          },
        },
      },
    })

    if (hostingRequest?.tournament) {
      tournament = hostingRequest.tournament
    }
  }

  if (!tournament) {
    notFound()
  }

  // Get user's clubs if logged in
  let userClubs: Array<{
    id: string
    name: string
    division: string
    teams: Array<{
      id: string
      name: string
      members: Array<{
        id: string
        userId: string
        role: string
        roles: string[]
        name: string
        email: string | null
      }>
    }>
  }> = []

  if (session?.user?.id) {
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
        role: 'ADMIN',
      },
      include: {
        club: {
          include: {
            teams: {
              include: {
                members: {
                  select: {
                    id: true,
                    userId: true,
                    role: true,
                    roles: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    const uniqueClubs = new Map()
    for (const membership of memberships) {
      if (!uniqueClubs.has(membership.club.id)) {
        uniqueClubs.set(membership.club.id, {
          id: membership.club.id,
          name: membership.club.name,
          division: membership.club.division,
          teams: (membership.club.teams || []).map((team) => ({
            id: team.id,
            name: team.name,
            members: (team.members || [])
              .map((member) => ({
                id: member.id,
                userId: member.userId,
                role: member.role,
                roles: member.roles,
                name: member.user.name?.trim() || member.user.email || 'Unnamed member',
                email: member.user.email,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          })),
        })
      }
    }
    userClubs = Array.from(uniqueClubs.values())
  }

  const displayDivision = tournament.hostingRequest?.division || tournament.division || 'C'
  const tournamentDivisions: Division[] = displayDivision === 'B&C'
    ? [Division.B, Division.C]
    : displayDivision === 'B'
    ? [Division.B]
    : [Division.C]

  // Load events offered by this tournament.
  const allDivisionEvents = await prisma.event.findMany({
    where: {
      division: {
        in: tournamentDivisions,
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      division: true,
    },
  })

  let eventsRunIds: string[] = []
  if (tournament.eventsRun && tournament.eventsRun.trim()) {
    try {
      const parsed = JSON.parse(tournament.eventsRun)
      if (Array.isArray(parsed)) {
        eventsRunIds = parsed.filter((id): id is string => typeof id === 'string')
      }
    } catch {
      eventsRunIds = []
    }
  }

  // If eventsRun is empty, treat it as "all events run".
  const availableEvents = eventsRunIds.length > 0
    ? allDivisionEvents.filter(event => eventsRunIds.includes(event.id))
    : allDivisionEvents

  // Normalize trial events (supports legacy string[] and current object[] storage).
  const trialEventsRaw = tournament.trialEvents
  const availableTrialEvents: Array<{ name: string; division: 'B' | 'C' }> = []
  if (trialEventsRaw && trialEventsRaw.trim()) {
    try {
      const parsed = JSON.parse(trialEventsRaw)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string') {
            const name = item.trim()
            if (!name) continue
            const fallbackDivision: 'B' | 'C' = tournament.division === 'B' ? 'B' : 'C'
            availableTrialEvents.push({ name, division: fallbackDivision })
            continue
          }

          if (item && typeof item === 'object' && 'name' in item) {
            const name = String(item.name ?? '').trim()
            if (!name) continue
            const parsedDivision = 'division' in item ? String(item.division ?? '') : ''
            const division: 'B' | 'C' =
              parsedDivision === 'B' || parsedDivision === 'C'
                ? parsedDivision
                : (tournament.division === 'B' ? 'B' : 'C')
            availableTrialEvents.push({ name, division })
          }
        }
      }
    } catch {
      // Ignore malformed trial event JSON.
    }
  }

  // Build default member assignment map from current roster assignments for each team.
  const allTeamIds = userClubs.flatMap(club => club.teams.map(team => team.id))
  const defaultMemberAssignments: Record<
    string,
    Record<string, { eventIds: string[]; eventNames: string[] }>
  > = {}

  if (allTeamIds.length > 0) {
    const rosterAssignments = await prisma.rosterAssignment.findMany({
      where: {
        teamId: {
          in: allTeamIds,
        },
        event: {
          division: {
            in: tournamentDivisions,
          },
        },
      },
      select: {
        teamId: true,
        membershipId: true,
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    for (const assignment of rosterAssignments) {
      const teamDefaults = defaultMemberAssignments[assignment.teamId] ?? {}
      const existing = teamDefaults[assignment.membershipId] ?? { eventIds: [], eventNames: [] }
      if (!existing.eventIds.includes(assignment.event.id)) {
        existing.eventIds.push(assignment.event.id)
      }
      if (!existing.eventNames.includes(assignment.event.name)) {
        existing.eventNames.push(assignment.event.name)
      }
      teamDefaults[assignment.membershipId] = existing
      defaultMemberAssignments[assignment.teamId] = teamDefaults
    }
  }

  const availableEventIdSet = new Set(availableEvents.map((event) => event.id))
  const conflictGroups = await prisma.conflictGroup.findMany({
    where: {
      division: {
        in: tournamentDivisions,
      },
    },
    include: {
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
    },
    orderBy: [
      { blockNumber: 'asc' },
      { division: 'asc' },
    ],
  })

  const conflictBlocks = conflictGroups
    .map((group) => {
      const events = group.events
        .map((item) => item.event)
        .filter((event) => availableEventIdSet.has(event.id))
        .sort((a, b) => a.name.localeCompare(b.name))

      return {
        id: group.id,
        division: group.division,
        blockNumber: group.blockNumber,
        name: group.name,
        events: events.map((event) => ({
          id: event.id,
          name: event.name,
          division: event.division,
        })),
      }
    })
    .filter((block) => block.events.length > 0)

  // Serialize dates and data
  const serializedTournament = {
    id: tournament.id,
    name: tournament.name,
    slug: tournament.slug,
    division: displayDivision,
    description: tournament.description,
    isOnline: tournament.isOnline,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
    location: tournament.location,
    price: tournament.price,
    additionalTeamPrice: tournament.additionalTeamPrice,
    feeStructure: tournament.feeStructure,
    registrationStartDate: tournament.registrationStartDate?.toISOString() || null,
    registrationEndDate: tournament.registrationEndDate?.toISOString() || null,
    earlyBirdDiscount: tournament.earlyBirdDiscount,
    earlyBirdDeadline: tournament.earlyBirdDeadline?.toISOString() || null,
    lateFee: tournament.lateFee,
    lateFeeStartDate: tournament.lateFeeStartDate?.toISOString() || null,
    eligibilityRequirements: tournament.eligibilityRequirements,
    directorName: tournament.hostingRequest?.directorName || null,
    directorEmail: tournament.hostingRequest?.directorEmail || null,
    eventsRun: tournament.eventsRun,
    trialEvents: tournament.trialEvents,
  }

  const serializedRegistrations = tournament.registrations.map(reg => ({
    id: reg.id,
    status: reg.status,
    paid: reg.paid,
    createdAt: reg.createdAt.toISOString(),
    club: reg.club,
    team: reg.team,
    registeredBy: reg.registeredBy,
  }))

  return (
    <TournamentRegistrationClient
      tournament={serializedTournament}
      registrations={serializedRegistrations}
      user={session?.user}
      userClubs={userClubs}
      availableEvents={availableEvents}
      availableTrialEvents={availableTrialEvents}
      defaultMemberAssignments={defaultMemberAssignments}
      conflictBlocks={conflictBlocks}
    />
  )
}
