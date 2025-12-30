import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ESPortalClient } from '@/components/es-portal-client'
import { ESLoginClient } from '@/components/es-login-client'
import { Suspense } from 'react'
import { Division } from '@prisma/client'

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

  // Prefetch tests server-side to eliminate loading delay
  // First, get hosting request divisions for all tournaments (needed for TD event fetching)
  const tournamentIds = staffMemberships.map(m => m.tournament.id)
  const hostingRequests = await prisma.tournamentHostingRequest.findMany({
    where: {
      tournament: {
        id: { in: tournamentIds },
      },
    },
    select: {
      id: true,
      division: true,
      tournament: {
        select: {
          id: true,
        },
      },
    },
  })
  const hostingRequestMap = new Map(
    hostingRequests
      .filter(hr => hr.tournament !== null)
      .map(hr => [hr.tournament!.id, hr.division])
  )

  // Get all event IDs that the user is assigned to (for ES) or all events for tournament division (for TD)
  const userEventIds = new Set<string>()
  const tdTournamentIds = new Set<string>()
  const tournamentDivisions = new Map<string, 'B' | 'C' | 'B&C'>()
  
  staffMemberships.forEach(membership => {
    if (membership.role === 'TOURNAMENT_DIRECTOR') {
      // For TDs, we'll fetch all events for the tournament's division
      tdTournamentIds.add(membership.tournament.id)
      // Get division from hosting request if available, otherwise from tournament
      const division = hostingRequestMap.get(membership.tournament.id) || membership.tournament.division
      tournamentDivisions.set(membership.tournament.id, division as 'B' | 'C' | 'B&C')
    } else {
      // For ES, use assigned events
      membership.events.forEach(e => userEventIds.add(e.event.id))
    }
  })

  // For TDs, fetch all events for their tournament's division
  const tdEventIds = new Set<string>()
  for (const [tournamentId, division] of tournamentDivisions.entries()) {
    // Fetch events matching the division (handle "B&C" as both B and C)
    const divisionsToFetch: Division[] = division === 'B&C' ? [Division.B, Division.C] : [division as Division]
    const events = await prisma.event.findMany({
      where: {
        division: { in: divisionsToFetch },
      },
      select: { id: true },
    })
    events.forEach(e => tdEventIds.add(e.id))
  }

  // Parse trial events from tournament configurations (needed for test organization)
  const tournamentTrialEventNamesByTournament = new Map<string, Array<{ name: string; division?: 'B' | 'C' }>>()
  for (const membership of staffMemberships) {
    if (membership.tournament.trialEvents) {
      try {
        const parsed = JSON.parse(membership.tournament.trialEvents)
        if (Array.isArray(parsed)) {
          // Handle both old format (string[]) and new format ({ name, division }[])
          if (parsed.length > 0 && typeof parsed[0] === 'string') {
            // Old format - convert to new format
            tournamentTrialEventNamesByTournament.set(
              membership.tournament.id,
              parsed.map((name: string) => ({ name }))
            )
          } else {
            // New format
            tournamentTrialEventNamesByTournament.set(
              membership.tournament.id,
              parsed.map((e: any) => ({ name: e.name, division: e.division }))
            )
          }
        }
      } catch (e) {
        console.error('Error parsing tournament trial events:', e)
      }
    }
  }

  // Create a map to check if user has access to a trial event in a tournament
  // For TDs: access to all trial events in their tournament
  // For ES: access only to trial events they're assigned to
  const userTrialEventAccess = new Map<string, Set<string>>() // tournamentId -> Set<trialEventName>
  for (const membership of staffMemberships) {
    const tournamentId = membership.tournament.id
    if (!userTrialEventAccess.has(tournamentId)) {
      userTrialEventAccess.set(tournamentId, new Set())
    }
    const accessSet = userTrialEventAccess.get(tournamentId)!
    
    if (membership.role === 'TOURNAMENT_DIRECTOR') {
      // TDs have access to all trial events in their tournament
      const allTrialEvents = tournamentTrialEventNamesByTournament.get(tournamentId) || []
      allTrialEvents.forEach(te => accessSet.add(te.name))
    } else {
      // ES members have access only to trial events they're assigned to
      if (membership.trialEvents) {
        try {
          const parsed = JSON.parse(membership.trialEvents)
          if (Array.isArray(parsed)) {
            const trialEventNames = parsed.length > 0 && typeof parsed[0] === 'string'
              ? parsed
              : parsed.map((e: any) => e.name)
            trialEventNames.forEach((name: string) => accessSet.add(name))
          }
        } catch (e) {
          console.error('Error parsing staff trial events:', e)
        }
      }
    }
  }

  // Combine ES assigned events and TD all events
  const allUserEventIds = new Set([...userEventIds, ...tdEventIds])
  const eventIdsArray = Array.from(allUserEventIds)
  
  // Fetch tests - include both regular events and trial events (eventId: null)
  const allTests = await prisma.eSTest.findMany({
    where: {
      tournamentId: { in: tournamentIds },
      OR: [
        // Tests with real eventIds
        ...(eventIdsArray.length > 0 ? [{ eventId: { in: eventIdsArray } }] : []),
        // Tests with null eventId (trial events)
        { eventId: null },
      ],
    },
    include: {
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
      questions: {
        include: {
          options: true,
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Fetch eventNames from CREATE audit logs for tests with null eventId (trial events)
  const testsWithNullEventId = allTests.filter(t => !t.eventId)
  const testEventNameMap = new Map<string, string>()
  if (testsWithNullEventId.length > 0) {
    const testIds = testsWithNullEventId.map(t => t.id)
    const createAudits = await prisma.eSTestAudit.findMany({
      where: {
        testId: { in: testIds },
        action: 'CREATE',
      },
      select: {
        testId: true,
        details: true,
      },
    })
    for (const audit of createAudits) {
      if (audit.testId && audit.details && typeof audit.details === 'object' && 'eventName' in audit.details) {
        const eventName = (audit.details as any).eventName
        if (eventName && typeof eventName === 'string') {
          testEventNameMap.set(audit.testId, eventName)
        }
      }
    }
  }

  // Organize tests by tournament and event
  // For regular events, use eventId as key
  // For trial events, use "trial-{eventName}" as key
  const testsByTournament = new Map<string, Map<string, typeof allTests>>()
  
  for (const test of allTests) {
    if (!testsByTournament.has(test.tournamentId)) {
      testsByTournament.set(test.tournamentId, new Map())
    }
    const testsByEvent = testsByTournament.get(test.tournamentId)!
    
    let eventKey: string
    if (test.eventId) {
      // Regular event - use eventId as key
      eventKey = test.eventId
    } else {
      // Trial event - use eventName from audit log
      const eventName = testEventNameMap.get(test.id)
      if (eventName) {
        // Check if user has access to this trial event
        const userAccess = userTrialEventAccess.get(test.tournamentId)
        const tournamentTrialEvents = tournamentTrialEventNamesByTournament.get(test.tournamentId) || []
        const trialEventNames = tournamentTrialEvents.map(te => te.name)
        
        if (userAccess && userAccess.has(eventName) && trialEventNames.includes(eventName)) {
          eventKey = `trial-${eventName}`
        } else {
          // Skip if user doesn't have access or event doesn't exist in tournament config
          continue
        }
      } else {
        // No eventName found in audit log - skip
        continue
      }
    }
    
    if (!testsByEvent.has(eventKey)) {
      testsByEvent.set(eventKey, [])
    }
    testsByEvent.get(eventKey)!.push(test)
  }

  // For TDs, get all events for their tournament's division
  const allEventsForTDs = new Map<string, Array<{ id: string; name: string; division: 'B' | 'C' }>>()
  for (const [tournamentId, division] of tournamentDivisions.entries()) {
    const divisionsToFetch: Division[] = division === 'B&C' ? [Division.B, Division.C] : [division as Division]
    const events = await prisma.event.findMany({
      where: {
        division: { in: divisionsToFetch },
      },
      select: {
        id: true,
        name: true,
        division: true,
      },
      orderBy: { name: 'asc' },
    })
    allEventsForTDs.set(tournamentId, events)
  }

  // Map staff memberships with tests organized by event
  const staffMembershipsWithTests = staffMemberships.map(membership => {
    // Use hosting request division for display if available (supports "B&C")
    const displayDivision = hostingRequestMap.get(membership.tournament.id) || membership.tournament.division
    
    // For TDs, use all events for the tournament's division; for ES, use assigned events
    const regularEventsToShow = membership.role === 'TOURNAMENT_DIRECTOR'
      ? (allEventsForTDs.get(membership.tournament.id) || []).map(event => ({
          event: {
            id: event.id,
            name: event.name,
            division: event.division,
          },
        }))
      : membership.events
    
    // For TDs, include all trial events; for ES, include only assigned trial events
    const trialEventsToShow = (() => {
      const tournamentTrialEvents = tournamentTrialEventNamesByTournament.get(membership.tournament.id) || []
      
      if (membership.role === 'TOURNAMENT_DIRECTOR') {
        // TDs have access to all trial events in their tournament
        return tournamentTrialEvents.map(trialEvent => {
          // Use division from trial event config, or fall back to tournament division
          const division = trialEvent.division || (membership.tournament.division as 'B' | 'C')
          return {
            event: {
              id: null, // Trial events don't have IDs
              name: trialEvent.name,
              division: division,
            },
          }
        })
      } else {
        // ES members have access only to trial events they're assigned to
        const assignedTrialEventNames = new Set<string>()
        if (membership.trialEvents) {
          try {
            const parsed = JSON.parse(membership.trialEvents)
            if (Array.isArray(parsed)) {
              const trialEventNames = parsed.length > 0 && typeof parsed[0] === 'string'
                ? parsed
                : parsed.map((e: any) => e.name)
              trialEventNames.forEach((name: string) => assignedTrialEventNames.add(name))
            }
          } catch (e) {
            console.error('Error parsing staff trial events:', e)
          }
        }
        
        // Filter tournament trial events to only those assigned to this ES
        return tournamentTrialEvents
          .filter(trialEvent => assignedTrialEventNames.has(trialEvent.name))
          .map(trialEvent => {
            // Use division from trial event config, or fall back to tournament division
            const division = trialEvent.division || (membership.tournament.division as 'B' | 'C')
            return {
              event: {
                id: null, // Trial events don't have IDs
                name: trialEvent.name,
                division: division,
              },
            }
          })
      }
    })()
    
    const eventsToShow = [...regularEventsToShow, ...trialEventsToShow]
    
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
      events: [...eventsToShow].sort((a, b) => a.event.name.localeCompare(b.event.name)).map(e => {
        // Look for tests for this event across ALL tournaments the user has access to
        // For regular events, use event.id; for trial events, use "trial-{eventName}"
        const eventKey = e.event.id ? e.event.id : `trial-${e.event.name}`
        let eventTests: typeof allTests = []
        for (const [tournamentId, eventMap] of testsByTournament.entries()) {
          const testsForEventInTournament = eventMap.get(eventKey) || []
          eventTests = [...eventTests, ...testsForEventInTournament]
        }
        
        return {
          event: {
            id: e.event.id,
            name: e.event.name,
            division: e.event.division,
          },
          tests: eventTests.map(test => ({
            id: test.id,
            name: test.name,
            status: test.status,
            eventId: test.eventId,
            createdAt: test.createdAt.toISOString(),
            updatedAt: test.updatedAt.toISOString(),
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
            questions: test.questions.map(q => ({
              id: q.id,
              type: q.type,
              promptMd: q.promptMd,
              points: Number(q.points),
              order: q.order,
              options: q.options.map(o => ({
                id: o.id,
                label: o.label,
                isCorrect: o.isCorrect,
                order: o.order,
              })),
            })),
          })),
        }
      }),
    }
  })

  // Use the staffMembershipsWithTests that includes server-side fetched tests
  const serializedStaffMemberships = staffMembershipsWithTests

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

