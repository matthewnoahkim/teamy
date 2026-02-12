import { prisma } from '@/lib/prisma'
import { Division } from '@prisma/client'

interface GetESTestsOptions {
  includeQuestions?: boolean
}

interface StaffMembershipWithTests {
  id: string
  email: string
  name: string | null
  role: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  invitedAt: string
  acceptedAt: string | null
  tournament: {
    id: string
    name: string
    division: 'B' | 'C' | 'B&C' | string
    startDate: string
    slug: string | null
  }
  events: Array<{
    event: {
      id: string | null
      name: string
      division: 'B' | 'C'
    }
    tests: Array<Record<string, unknown>>
  }>
}

/**
 * Get ES tests organized by event for a user
 * This is shared logic used by both the API route and server component
 */
export async function getESTestsForUser(
  userId: string,
  email: string,
  options: GetESTestsOptions = {}
): Promise<StaffMembershipWithTests[]> {
  const { includeQuestions = true } = options

  // Parallelize all initial queries
  const [staffMemberships, tournamentAdmins, createdTournaments, directorHostingRequests] = 
    await Promise.all([
      prisma.tournamentStaff.findMany({
        where: {
          OR: [
            { userId },
            { email: { equals: email, mode: 'insensitive' } },
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
        },
      }),
      prisma.tournamentAdmin.findMany({
        where: { userId },
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
      }),
      prisma.tournament.findMany({
        where: { createdById: userId },
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
      }),
      prisma.tournamentHostingRequest.findMany({
        where: {
          directorEmail: { equals: email, mode: 'insensitive' },
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
      }),
    ])

  // Combine all tournament access
  const tournamentIdsSet = new Set(staffMemberships.map(m => m.tournament.id))
  
  for (const admin of tournamentAdmins) {
    if (admin.tournament && !tournamentIdsSet.has(admin.tournament.id)) {
      tournamentIdsSet.add(admin.tournament.id)
      staffMemberships.push({
        id: `admin-${admin.id}`,
        userId,
        email,
        name: null,
        role: 'TOURNAMENT_DIRECTOR' as const,
        status: 'ACCEPTED' as const,
        tournamentId: admin.tournament.id,
        inviteToken: `admin-${admin.id}-${admin.tournament.id}`,
        invitedAt: new Date(),
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        trialEvents: null,
        tournament: admin.tournament,
        events: [],
      } as (typeof staffMemberships)[number])
    }
  }

  for (const tournament of createdTournaments) {
    if (!tournamentIdsSet.has(tournament.id)) {
      tournamentIdsSet.add(tournament.id)
      staffMemberships.push({
        id: `creator-${tournament.id}`,
        userId,
        email,
        name: null,
        role: 'TOURNAMENT_DIRECTOR' as const,
        status: 'ACCEPTED' as const,
        tournamentId: tournament.id,
        inviteToken: `creator-${tournament.id}`,
        invitedAt: new Date(),
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        trialEvents: null,
        tournament: tournament,
        events: [],
      } as (typeof staffMemberships)[number])
    }
  }

  for (const request of directorHostingRequests) {
    if (request.tournament && !tournamentIdsSet.has(request.tournament.id)) {
      tournamentIdsSet.add(request.tournament.id)
      staffMemberships.push({
        id: `hosting-${request.id}`,
        userId,
        email,
        name: null,
        role: 'TOURNAMENT_DIRECTOR' as const,
        status: 'ACCEPTED' as const,
        tournamentId: request.tournament.id,
        inviteToken: `hosting-${request.id}`,
        invitedAt: new Date(),
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        trialEvents: null,
        tournament: request.tournament,
        events: [],
      } as (typeof staffMemberships)[number])
    }
  }

  const tournamentIds = staffMemberships.map(m => m.tournament.id)
  if (tournamentIds.length === 0) {
    return []
  }

  // Get hosting request divisions in parallel with other setup
  const [hostingRequests] = await Promise.all([
    prisma.tournamentHostingRequest.findMany({
      where: {
        tournament: { id: { in: tournamentIds } },
      },
      select: {
        id: true,
        division: true,
        tournament: {
          select: { id: true },
        },
      },
    }),
  ])

  const hostingRequestMap = new Map(
    hostingRequests
      .filter(hr => hr.tournament !== null)
      .map(hr => [hr.tournament!.id, hr.division])
  )

  // Parse trial events
  const tournamentTrialEventNamesByTournament = new Map<string, string[]>()
  const userTrialEventNamesByTournament = new Map<string, Set<string>>()
  
  for (const membership of staffMemberships) {
    if (membership.tournament.trialEvents) {
      try {
        const parsed = JSON.parse(membership.tournament.trialEvents)
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && typeof parsed[0] === 'string') {
            tournamentTrialEventNamesByTournament.set(membership.tournament.id, parsed)
          } else {
            tournamentTrialEventNamesByTournament.set(membership.tournament.id, parsed.map((e: { name: string }) => e.name))
          }
        }
      } catch (e) {
        console.error('Error parsing tournament trial events:', e)
      }
    }

    if (membership.trialEvents && membership.role !== 'TOURNAMENT_DIRECTOR') {
      try {
        const parsed = JSON.parse(membership.trialEvents)
        if (Array.isArray(parsed)) {
          const trialEventNames = parsed.length > 0 && typeof parsed[0] === 'string'
            ? parsed
            : parsed.map((e: { name: string }) => e.name)
          
          if (!userTrialEventNamesByTournament.has(membership.tournament.id)) {
            userTrialEventNamesByTournament.set(membership.tournament.id, new Set())
          }
          trialEventNames.forEach((name: string) => {
            userTrialEventNamesByTournament.get(membership.tournament.id)!.add(name)
          })
        }
      } catch (e) {
        console.error('Error parsing staff trial events:', e)
      }
    }
  }

  // Build event ID sets per tournament
  const tournamentDivisions = new Map<string, 'B' | 'C' | 'B&C'>()
  const eventIdsByTournament = new Map<string, Set<string>>()
  
  staffMemberships.forEach(membership => {
    if (membership.role === 'TOURNAMENT_DIRECTOR') {
      const divisionFromHosting = hostingRequestMap.get(membership.tournament.id)
      const divisionFromTournament = membership.tournament.division
      const division = divisionFromHosting || (divisionFromTournament === Division.B ? 'B' : divisionFromTournament === Division.C ? 'C' : String(divisionFromTournament))
      tournamentDivisions.set(membership.tournament.id, division as 'B' | 'C' | 'B&C')
    } else {
      const tournamentId = membership.tournament.id
      if (!eventIdsByTournament.has(tournamentId)) {
        eventIdsByTournament.set(tournamentId, new Set())
      }
      membership.events.forEach(e => {
        eventIdsByTournament.get(tournamentId)!.add(e.event.id)
      })
    }
  })

  // Batch fetch all events for all divisions in one query
  const allDivisions = Array.from(new Set(tournamentDivisions.values()))
  const divisionsToFetch: Division[] = []
  if (allDivisions.includes('B&C') || allDivisions.includes('B') || allDivisions.includes('C')) {
    divisionsToFetch.push(Division.B, Division.C)
  } else {
    allDivisions.forEach(div => {
      if (div === 'B') divisionsToFetch.push(Division.B)
      if (div === 'C') divisionsToFetch.push(Division.C)
    })
  }

  const allDivisionEvents = divisionsToFetch.length > 0
    ? await prisma.event.findMany({
        where: {
          division: { in: [...new Set(divisionsToFetch)] },
        },
        select: {
          id: true,
          name: true,
          division: true,
        },
      })
    : []

  // Group events by tournament division in memory
  for (const [tournamentId, division] of tournamentDivisions.entries()) {
    if (!eventIdsByTournament.has(tournamentId)) {
      eventIdsByTournament.set(tournamentId, new Set())
    }
    const divisionsToMatch: Division[] = division === 'B&C' 
      ? [Division.B, Division.C] 
      : division === 'B'
        ? [Division.B]
        : [Division.C]
    allDivisionEvents
      .filter(e => divisionsToMatch.includes(e.division))
      .forEach(e => eventIdsByTournament.get(tournamentId)!.add(e.id))
  }

  // Batch fetch all tests for all tournaments in one query
  const allTests = await prisma.eSTest.findMany({
    where: {
      tournamentId: { in: tournamentIds },
    },
    select: {
      id: true,
      name: true,
      status: true,
      tournamentId: true,
      eventId: true,
      createdAt: true,
      updatedAt: true,
      allowNoteSheet: true,
      event: {
        select: {
          id: true,
          name: true,
        },
      },
      staff: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      questions: includeQuestions ? {
        include: {
          options: true,
        },
        orderBy: { order: 'asc' },
      } : undefined,
    },
    orderBy: { createdAt: 'desc' },
  })

  // Batch fetch all audit logs for trial events in one query
  const testsWithNullEventId = allTests.filter(t => !t.eventId)
  const testIdsForAudits = testsWithNullEventId.map(t => t.id)
  const allCreateAudits = testIdsForAudits.length > 0
    ? await prisma.eSTestAudit.findMany({
        where: {
          testId: { in: testIdsForAudits },
          action: 'CREATE',
        },
        select: {
          testId: true,
          details: true,
        },
      })
    : []

  const testEventNameMap = new Map<string, string>()
  for (const audit of allCreateAudits) {
    if (audit.testId && audit.details && typeof audit.details === 'object' && 'eventName' in audit.details) {
      const eventName = (audit.details as Record<string, unknown>).eventName
      if (eventName && typeof eventName === 'string') {
        testEventNameMap.set(audit.testId, eventName)
      }
    }
  }

  // Organize tests by tournament and event in memory
  const testsByTournament = new Map<string, Map<string, typeof allTests>>()
  const userTrialEventAccess = new Map<string, Set<string>>()
  
  for (const membership of staffMemberships) {
    const tournamentId = membership.tournament.id
    if (!userTrialEventAccess.has(tournamentId)) {
      userTrialEventAccess.set(tournamentId, new Set())
    }
    const accessSet = userTrialEventAccess.get(tournamentId)!
    
    if (membership.role === 'TOURNAMENT_DIRECTOR') {
      const allTrialEvents = tournamentTrialEventNamesByTournament.get(tournamentId) || []
      allTrialEvents.forEach(name => accessSet.add(name))
    } else {
      const assignedTrialEvents = userTrialEventNamesByTournament.get(tournamentId)
      if (assignedTrialEvents) {
        assignedTrialEvents.forEach(name => accessSet.add(name))
      }
    }
  }

  // Group tests by tournament
  for (const test of allTests) {
    const tournamentId = test.tournamentId
    if (!testsByTournament.has(tournamentId)) {
      testsByTournament.set(tournamentId, new Map())
    }
    const testsByEvent = testsByTournament.get(tournamentId)!
    
    const allowedEventIds = eventIdsByTournament.get(tournamentId) || new Set<string>()
    const tournamentTrialEvents = tournamentTrialEventNamesByTournament.get(tournamentId) || []
    const userAccess = userTrialEventAccess.get(tournamentId) || new Set<string>()
    
    let eventKey: string | null = null
    
    if (test.eventId) {
      if (allowedEventIds.has(test.eventId)) {
        eventKey = test.eventId
      }
    } else {
      const eventName = testEventNameMap.get(test.id)
      if (eventName && userAccess.has(eventName) && tournamentTrialEvents.includes(eventName)) {
        eventKey = `trial-${eventName}`
      }
    }
    
    if (eventKey) {
      if (!testsByEvent.has(eventKey)) {
        testsByEvent.set(eventKey, [])
      }
      testsByEvent.get(eventKey)!.push(test)
    }
  }

  // Get all events for TDs (batch fetch)
  const allEventsForTDs = new Map<string, Array<{ id: string; name: string; division: 'B' | 'C' }>>()
  const uniqueDivisions = Array.from(new Set(tournamentDivisions.values()))
  const allDivisionsToFetch: Division[] = []
  if (uniqueDivisions.includes('B&C')) {
    allDivisionsToFetch.push(Division.B, Division.C)
  } else {
    if (uniqueDivisions.includes('B')) allDivisionsToFetch.push(Division.B)
    if (uniqueDivisions.includes('C')) allDivisionsToFetch.push(Division.C)
  }

  const allTDEvents = allDivisionsToFetch.length > 0
    ? await prisma.event.findMany({
        where: {
          division: { in: [...new Set(allDivisionsToFetch)] },
        },
        select: {
          id: true,
          name: true,
          division: true,
        },
        orderBy: { name: 'asc' },
      })
    : []

  // Group events by tournament division
  for (const [tournamentId, division] of tournamentDivisions.entries()) {
    const divisionsToMatch: Division[] = division === 'B&C' 
      ? [Division.B, Division.C] 
      : division === 'B'
        ? [Division.B]
        : [Division.C]
    allEventsForTDs.set(
      tournamentId,
      allTDEvents.filter(e => divisionsToMatch.includes(e.division))
    )
  }

  // Map staff memberships with tests
  return staffMemberships.map(membership => {
    const divisionFromHosting = hostingRequestMap.get(membership.tournament.id)
    const divisionFromTournament = membership.tournament.division
    const displayDivision = divisionFromHosting || (divisionFromTournament === Division.B ? 'B' : divisionFromTournament === Division.C ? 'C' : String(divisionFromTournament))
    
    const eventsToShow = membership.role === 'TOURNAMENT_DIRECTOR'
      ? (allEventsForTDs.get(membership.tournament.id) || []).map(event => ({
          event: {
            id: event.id,
            name: event.name,
            division: event.division,
          },
        }))
      : membership.events

    const trialEventNames = tournamentTrialEventNamesByTournament.get(membership.tournament.id) || []
    const userHasAccessToTrialEvents = userTrialEventAccess.get(membership.tournament.id)
    
    const trialEventsToShow = trialEventNames
      .filter(trialEventName => {
        return membership.role === 'TOURNAMENT_DIRECTOR' || 
               (userHasAccessToTrialEvents && userHasAccessToTrialEvents.has(trialEventName))
      })
      .map(trialEventName => {
        let division = membership.tournament.division as 'B' | 'C'
        if (membership.tournament.trialEvents) {
          try {
            const parsed = JSON.parse(membership.tournament.trialEvents)
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] !== 'string') {
              const trialEvent = parsed.find((e: { name: string; division?: string }) => e.name === trialEventName)
              if (trialEvent && trialEvent.division) {
                division = trialEvent.division
              }
            }
          } catch (_e) {
            // Use default division
          }
        }
        return {
          event: {
            id: null,
            name: trialEventName,
            division: division,
          },
        }
      })
    
    return {
      id: membership.id,
      email: membership.email,
      name: membership.name,
      role: membership.role,
      status: membership.status,
      invitedAt: membership.invitedAt.toISOString(),
      acceptedAt: membership.acceptedAt?.toISOString() || null,
      tournament: {
        id: membership.tournament.id,
        name: membership.tournament.name,
        division: displayDivision,
        startDate: membership.tournament.startDate.toISOString(),
        slug: membership.tournament.slug,
      },
      events: [...eventsToShow, ...trialEventsToShow].sort((a, b) => a.event.name.localeCompare(b.event.name)).map(e => {
        const eventKey = e.event.id ? e.event.id : `trial-${e.event.name}`
        const eventMap = testsByTournament.get(membership.tournament.id) || new Map()
        const eventTests = eventMap.get(eventKey) || []
        
        const filteredEventTests = eventTests.filter((test: any) => {
          if (test.tournamentId !== membership.tournament.id) {
            console.error(`CRITICAL ERROR: Test ${test.id} has tournamentId ${test.tournamentId} but is being shown for tournament ${membership.tournament.id}`)
            return false
          }
          return true
        })
        
        return {
          event: {
            id: e.event.id,
            name: e.event.name,
            division: e.event.division,
          },
          tests: filteredEventTests.map((test: any) => ({
            id: test.id,
            name: test.name,
            status: test.status,
            eventId: test.eventId,
            createdAt: test.createdAt.toISOString(),
            updatedAt: test.updatedAt.toISOString(),
            allowNoteSheet: test.allowNoteSheet ?? false,
            event: test.event ? {
              id: test.event.id,
              name: test.event.name,
            } : null,
            staff: test.staff ? {
              id: test.staff.id,
              name: test.staff.name,
              email: test.staff.email,
            } : undefined,
            createdBy: test.createdBy ? {
              id: test.createdBy.id,
              name: test.createdBy.name,
              email: test.createdBy.email,
            } : undefined,
            questions: includeQuestions && test.questions ? test.questions.map((q: any) => ({
              id: q.id,
              type: q.type,
              promptMd: q.promptMd,
              points: Number(q.points),
              order: q.order,
              options: q.options.map((o: any) => ({
                id: o.id,
                label: o.label,
                isCorrect: o.isCorrect,
                order: o.order,
              })),
            })) : undefined,
          })),
        }
      }),
    }
  })
}
