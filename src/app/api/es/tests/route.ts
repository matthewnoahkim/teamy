import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CalculatorType, Division } from '@prisma/client'

// Helper to check if user is a tournament director for a tournament
async function isTournamentDirector(userId: string, userEmail: string, tournamentId: string): Promise<boolean> {
  // Check if user is tournament admin
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  
  if (admin) return true
  
  // Check if user created the tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  if (tournament?.createdById === userId) return true
  
  // Check if user is the director on the hosting request
  const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
    where: {
      tournament: {
        id: tournamentId,
      },
      directorEmail: {
        equals: userEmail,
        mode: 'insensitive',
      },
      status: 'APPROVED',
    },
  })
  
  return !!hostingRequest
}

// GET /api/es/tests - List ES tests organized by event for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find staff memberships for this user
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
            trialEvents: true, // Include trial events from tournament
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
    })

    // Get hosting request divisions for all tournaments (needed for TD event fetching)
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

    // Track trial event names per tournament for ES members
    // For TDs, they get all trial events from the tournament
    const userTrialEventNamesByTournament = new Map<string, Set<string>>()
    const tournamentTrialEventNamesByTournament = new Map<string, string[]>()
    
    // Get trial events from tournament configuration
    for (const membership of staffMemberships) {
      if (membership.tournament.trialEvents) {
        try {
          const parsed = JSON.parse(membership.tournament.trialEvents)
          if (Array.isArray(parsed)) {
            // Handle both old format (string[]) and new format ({ name, division }[])
            if (parsed.length > 0 && typeof parsed[0] === 'string') {
              // Old format
              tournamentTrialEventNamesByTournament.set(membership.tournament.id, parsed)
            } else {
              // New format
              tournamentTrialEventNamesByTournament.set(membership.tournament.id, parsed.map((e: any) => e.name))
            }
          }
        } catch (e) {
          console.error('Error parsing tournament trial events:', e)
        }
      }
    }
    
    // Get all event IDs that the user is assigned to (for ES) or all events for tournament division (for TD)
    const userEventIds = new Set<string>()
    const tournamentDivisions = new Map<string, 'B' | 'C' | 'B&C'>()
    
    staffMemberships.forEach(membership => {
      if (membership.role === 'TOURNAMENT_DIRECTOR') {
        // For TDs, we'll fetch all events for the tournament's division
        // TDs can see all trial events for their tournament
        const division = hostingRequestMap.get(membership.tournament.id) || membership.tournament.division
        tournamentDivisions.set(membership.tournament.id, division as 'B' | 'C' | 'B&C')
      } else {
        // For ES, use assigned events
        membership.events.forEach(e => userEventIds.add(e.event.id))
        
        // Also get trial events assigned to this ES member
        if (membership.trialEvents) {
          try {
            const parsed = JSON.parse(membership.trialEvents)
            if (Array.isArray(parsed)) {
              // Handle both old format (string[]) and new format ({ name, division }[])
              const trialEventNames = parsed.length > 0 && typeof parsed[0] === 'string'
                ? parsed
                : parsed.map((e: any) => e.name)
              
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

    // Combine ES assigned events and TD all events
    const allUserEventIds = new Set([...userEventIds, ...tdEventIds])

    console.log('Fetching ES tests for user:', session.user.email)
    console.log('User event IDs:', Array.from(allUserEventIds))
    console.log('User tournament IDs:', tournamentIds)

    // First, let's check ALL tests in the tournaments to see what exists
    const allTournamentTests = await prisma.eSTest.findMany({
      where: {
        tournamentId: { in: tournamentIds },
      },
      select: {
        id: true,
        name: true,
        eventId: true,
        tournamentId: true,
        staffId: true,
        createdByStaffId: true,
      },
    })
    console.log('ALL tests in user tournaments:', allTournamentTests)

    // Fetch all tests for events the user is assigned to (collaborative access)
    // For TDs, this includes all events in their tournament's division
    // This returns ALL tests for events the user has access to, regardless of who created them
    // IMPORTANT: We don't filter by staffId - all staff assigned to an event can see all tests for that event
    const eventIdsArray = Array.from(allUserEventIds)
    console.log('Querying tests with:', { tournamentIds, eventIdsArray })
    
    // Query tests with eventIds OR with null eventId (trial events)
    const allTests = await prisma.eSTest.findMany({
      where: {
        tournamentId: { in: tournamentIds },
        OR: [
          // Tests with real eventIds
          ...(eventIdsArray.length > 0 ? [{ eventId: { in: eventIdsArray } }] : []),
          // Tests with null eventId (trial events)
          { eventId: null },
        ],
        // No filter by staffId - we want ALL tests for shared events (collaborative)
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

    console.log('Found tests:', allTests.length)
    console.log('Tests details:', allTests.map(t => ({ 
      id: t.id, 
      name: t.name, 
      eventId: t.eventId, 
      tournamentId: t.tournamentId,
      staffId: t.staffId, 
      createdBy: t.createdByStaffId,
      createdByEmail: t.createdBy?.email 
    })))

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
        allTrialEvents.forEach(name => accessSet.add(name))
      } else {
        // ES members have access only to trial events they're assigned to
        const assignedTrialEvents = userTrialEventNamesByTournament.get(tournamentId)
        if (assignedTrialEvents) {
          assignedTrialEvents.forEach(name => accessSet.add(name))
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
          if (userAccess && userAccess.has(eventName)) {
            // Also verify the trial event exists in the tournament's configured trial events
            const tournamentTrialEvents = tournamentTrialEventNamesByTournament.get(test.tournamentId) || []
            if (tournamentTrialEvents.includes(eventName)) {
              eventKey = `trial-${eventName}`
            } else {
              // Skip if trial event name doesn't match any configured trial event
              console.log('Skipping test with unknown trial event name:', test.id, test.name, eventName)
              continue
            }
          } else {
            // User doesn't have access to this trial event - skip
            console.log('Skipping test - user does not have access to trial event:', test.id, test.name, eventName)
            continue
          }
        } else {
          // No eventName found in audit log - skip
          console.log('Skipping test without eventName in audit log:', test.id, test.name)
          continue
        }
      }
      
      if (!testsByEvent.has(eventKey)) {
        testsByEvent.set(eventKey, [])
      }
      testsByEvent.get(eventKey)!.push(test)
    }
    
    console.log('Tests organized by tournament:', Array.from(testsByTournament.keys()))
    for (const [tournamentId, eventMap] of testsByTournament.entries()) {
      console.log(`Tournament ${tournamentId} has tests for events:`, Array.from(eventMap.keys()))
      for (const [eventId, tests] of eventMap.entries()) {
        console.log(`  Event ${eventId} has ${tests.length} tests:`, tests.map(t => t.name))
      }
    }

    // For TDs, get all events for their tournament's division
    const allEventsForTDs = new Map<string, Array<{ id: string; name: string; division: 'B' | 'C' }>>()
    for (const [tournamentId, division] of tournamentDivisions.entries()) {
      const divisionsToFetch = division === 'B&C' ? ['B', 'C'] : [division]
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
    // For each event assignment, look for tests in ANY tournament the user has access to
    // (not just the membership's tournament) - this enables cross-tournament test visibility
    const staffMembershipsWithTests = staffMemberships.map(membership => {
      // Use hosting request division for display if available (supports "B&C")
      const displayDivision = hostingRequestMap.get(membership.tournament.id) || membership.tournament.division
      
      // For TDs, use all events for the tournament's division; for ES, use assigned events
      const eventsToShow = membership.role === 'TOURNAMENT_DIRECTOR'
        ? (allEventsForTDs.get(membership.tournament.id) || []).map(event => ({
            event: {
              id: event.id,
              name: event.name,
              division: event.division,
            },
          }))
        : membership.events

      // Get trial events for this tournament that the user has access to
      const trialEventNames = tournamentTrialEventNamesByTournament.get(membership.tournament.id) || []
      const userHasAccessToTrialEvents = userTrialEventAccess.get(membership.tournament.id)
      
      // For TDs: show all trial events for their tournament
      // For ES: show only trial events they're assigned to
      const trialEventsToShow = trialEventNames
        .filter(trialEventName => {
          // TDs can see all trial events, ES can only see assigned ones
          return membership.role === 'TOURNAMENT_DIRECTOR' || 
                 (userHasAccessToTrialEvents && userHasAccessToTrialEvents.has(trialEventName))
        })
        .map(trialEventName => {
          // Get division from tournament trial events if available
          let division = membership.tournament.division as 'B' | 'C'
          if (membership.tournament.trialEvents) {
            try {
              const parsed = JSON.parse(membership.tournament.trialEvents)
              if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] !== 'string') {
                const trialEvent = parsed.find((e: any) => e.name === trialEventName)
                if (trialEvent && trialEvent.division) {
                  division = trialEvent.division
                }
              }
            } catch (e) {
              // Use default division
            }
          }
          return {
            event: {
              id: null, // Trial events don't have IDs
              name: trialEventName,
              division: division,
            },
          }
        })
      
      const membershipData = {
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
          // Look for tests for this event across ALL tournaments the user has access to
          // This allows tests to be visible to all ESs assigned to the same event, even if they're in different tournament memberships
          let eventTests: typeof allTests = []
          for (const [tournamentId, eventMap] of testsByTournament.entries()) {
            // Check if user has access to this tournament (they should, since testsByTournament only contains their tournaments)
            // and if there are tests for this event in this tournament
            // For regular events, use event.id; for trial events, use "trial-{eventName}"
            const eventKey = e.event.id ? e.event.id : `trial-${e.event.name}`
            const testsForEventInTournament = eventMap.get(eventKey) || []
            eventTests = [...eventTests, ...testsForEventInTournament]
          }
          console.log(`Mapping tests for membership ${membership.id}, tournament ${membership.tournament.id}, event ${e.event.id || `trial-${e.event.name}`}:`, eventTests.length, 'tests')
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
      console.log(`Membership ${membership.id} has ${membershipData.events.length} events with tests`)
      return membershipData
    })

    return NextResponse.json({ staffMemberships: staffMembershipsWithTests })
  } catch (error) {
    console.error('Error fetching ES tests:', error)
    return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 })
  }
}

// POST /api/es/tests - Create a new ES test
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      staffId, 
      tournamentId, 
      eventId, 
      eventName,
      name, 
      description, 
      instructions, 
      durationMinutes, 
      startAt,
      endAt,
      allowLateUntil,
      allowCalculator,
      allowNoteSheet,
      calculatorType,
      noteSheetInstructions,
      autoApproveNoteSheet,
      requireOneSitting,
      questions 
    } = body as {
      staffId: string
      tournamentId: string
      eventId?: string
      eventName?: string
      name: string
      description?: string
      instructions?: string
      durationMinutes?: number
      startAt?: string
      endAt?: string
      allowLateUntil?: string
      allowCalculator?: boolean
      allowNoteSheet?: boolean
      calculatorType?: CalculatorType
      noteSheetInstructions?: string
      autoApproveNoteSheet?: boolean
      requireOneSitting?: boolean
      questions?: Array<{
        type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMERIC'
        promptMd: string
        explanation?: string
        points: number
        order: number
        shuffleOptions?: boolean
        numericTolerance?: number
        options?: Array<{
          label: string
          isCorrect: boolean
          order: number
        }>
      }>
    }

    if (!staffId || !tournamentId || !name) {
      return NextResponse.json({ error: 'Staff ID, tournament ID, and name are required' }, { status: 400 })
    }

    // Verify the user owns this staff membership
    const staff = await prisma.tournamentStaff.findFirst({
      where: {
        id: staffId,
        OR: [
          { userId: session.user.id },
          { email: { equals: session.user.email, mode: 'insensitive' } },
        ],
        status: 'ACCEPTED',
      },
    })

    if (!staff) {
      return NextResponse.json({ error: 'Not authorized to create tests for this staff membership' }, { status: 403 })
    }

    console.log('Creating ES test:', { staffId, tournamentId, eventId, name })
    
    // Create the test with questions and audit log in a transaction
    const test = await prisma.$transaction(async (tx) => {
      // Base data without requireOneSitting
      const baseData: any = {
        staffId,
        createdByStaffId: staffId, // Track original creator
        tournamentId,
        eventId: eventId || null, // Ensure we store null if not provided
        name,
        description,
        instructions,
        durationMinutes: durationMinutes || 60,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        allowLateUntil: allowLateUntil ? new Date(allowLateUntil) : null,
        allowCalculator: allowCalculator ?? false,
        allowNoteSheet: allowNoteSheet ?? false,
        calculatorType: allowCalculator && calculatorType ? calculatorType as 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING' : null,
        noteSheetInstructions: allowNoteSheet ? (noteSheetInstructions || null) : null,
        autoApproveNoteSheet: allowNoteSheet ? (autoApproveNoteSheet ?? true) : true,
      }
      
      const createdTest = await tx.eSTest.create({
        data: {
          ...baseData,
          requireOneSitting: requireOneSitting ?? true,
          questions: questions && questions.length > 0
            ? {
                create: questions.map((q, index) => ({
                  type: q.type,
                  promptMd: q.promptMd,
                  explanation: q.explanation,
                  points: q.points,
                  order: q.order ?? index,
                  shuffleOptions: q.shuffleOptions || false,
                  numericTolerance: q.numericTolerance,
                  options: q.options && q.options.length > 0
                    ? {
                        create: q.options.map((opt, optIndex) => ({
                          label: opt.label,
                          isCorrect: opt.isCorrect,
                          order: opt.order ?? optIndex,
                        })),
                      }
                    : undefined,
                })),
              }
            : undefined,
        },
      })

      // Get event name - either from the event relation or from the provided eventName (for trial events)
      let finalEventName: string | null = null
      if (eventId) {
        const event = await tx.event.findUnique({
          where: { id: eventId },
          select: { name: true },
        })
        finalEventName = event?.name || null
      } else if (eventName) {
        // For trial events, use the provided eventName
        finalEventName = eventName
      }

      // Create audit log for test creation
      await tx.eSTestAudit.create({
        data: {
          testId: createdTest.id,
          actorStaffId: staffId,
          action: 'CREATE',
          details: {
            testName: createdTest.name,
            eventId: eventId || null,
            eventName: finalEventName,
          },
        },
      })

      // Fetch the complete test with relations
      return await tx.eSTest.findUnique({
        where: { id: createdTest.id },
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
      })
    })

    return NextResponse.json({ test })
  } catch (error) {
    console.error('Error creating ES test:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create test'
    // Check for database schema errors
    if (errorMessage.includes('createdByStaffId') || errorMessage.includes('column') || errorMessage.includes('field')) {
      return NextResponse.json({ 
        error: 'Database schema error. Please run migrations: npx prisma migrate deploy',
        details: errorMessage 
      }, { status: 500 })
    }
    return NextResponse.json({ 
      error: errorMessage || 'Failed to create test',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// PUT /api/es/tests - Update an ES test
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      testId, 
      name, 
      description, 
      instructions, 
      durationMinutes, 
      status, 
      eventId, 
      startAt,
      endAt,
      allowLateUntil,
      allowCalculator,
      allowNoteSheet,
      calculatorType,
      noteSheetInstructions,
      autoApproveNoteSheet,
      requireOneSitting,
      questions 
    } = body as {
      testId: string
      name?: string
      description?: string
      instructions?: string
      durationMinutes?: number
      status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
      eventId?: string
      startAt?: string
      endAt?: string
      allowLateUntil?: string
      allowCalculator?: boolean
      allowNoteSheet?: boolean
      calculatorType?: CalculatorType
      noteSheetInstructions?: string
      autoApproveNoteSheet?: boolean
      requireOneSitting?: boolean
      questions?: Array<{
        id?: string
        type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMERIC'
        promptMd: string
        explanation?: string
        points: number
        order: number
        shuffleOptions?: boolean
        numericTolerance?: number
        options?: Array<{
          id?: string
          label: string
          isCorrect: boolean
          order: number
        }>
      }>
    }

    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 })
    }

    // First, get the existing test to check its event
    const existingTest = await prisma.eSTest.findUnique({
      where: { id: testId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!existingTest) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Prevent editing published tests
    if (existingTest.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Cannot edit published tests' },
        { status: 403 }
      )
    }

    // Verify the user has access to this test (check ALL staff memberships to see if any has access to this event)
    const userStaffMemberships = await prisma.tournamentStaff.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { email: { equals: session.user.email, mode: 'insensitive' } },
        ],
        status: 'ACCEPTED',
      },
      include: {
        events: {
          select: {
            eventId: true,
          },
        },
      },
    })

    // Check if user is a tournament director for this tournament first
    // (TDs might not have staff memberships)
    const isTD = await isTournamentDirector(session.user.id, session.user.email, existingTest.tournamentId)

    // Get the staff member who is making the edit
    let editingStaff: { id: string } | null = null
    
    if (isTD) {
      // For TDs, find or use the first staff membership, or use the test's current staff
      editingStaff = existingTest.staffId ? { id: existingTest.staffId } : null
    } else {
      // For non-TDs, check staff membership and event access
      if (!userStaffMemberships || userStaffMemberships.length === 0) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      // Check if user is assigned to the same event as the test (collaborative access)
      // User must be assigned to the event in at least one of their staff memberships
      const hasEventAccess = existingTest.eventId && userStaffMemberships.some(staff => 
        staff.events.some(e => e.eventId === existingTest.eventId)
      )

      if (!hasEventAccess) {
        return NextResponse.json({ error: 'Not authorized to edit this test' }, { status: 403 })
      }

      // Use the first matching staff membership
      editingStaff = userStaffMemberships[0] ? { id: userStaffMemberships[0].id } : null
    }

    if (!editingStaff) {
      return NextResponse.json({ error: 'Could not determine staff member' }, { status: 400 })
    }

    // Calculate new start/end times for validation and change tracking
    const newStartAt = startAt !== undefined
      ? (startAt ? new Date(startAt) : null)
      : existingTest.startAt
    const newEndAt = endAt !== undefined
      ? (endAt ? new Date(endAt) : null)
      : existingTest.endAt
    
    // Validate that end time is after start time if both are set
    if (newStartAt && newEndAt && newEndAt <= newStartAt) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      )
    }
    
    // Track what fields are being changed for audit log
    const changedFields: string[] = []
    if (name && name !== existingTest.name) changedFields.push('name')
    if (description !== undefined && description !== existingTest.description) changedFields.push('description')
    if (instructions !== undefined && instructions !== existingTest.instructions) changedFields.push('instructions')
    if (durationMinutes && durationMinutes !== existingTest.durationMinutes) changedFields.push('durationMinutes')
    if (status && status !== existingTest.status) changedFields.push('status')
    if (eventId !== undefined && eventId !== existingTest.eventId) changedFields.push('eventId')
    if (startAt !== undefined) {
      const existingStartAt = existingTest.startAt
      if (newStartAt?.getTime() !== existingStartAt?.getTime()) changedFields.push('startAt')
    }
    if (endAt !== undefined) {
      const existingEndAt = existingTest.endAt
      if (newEndAt?.getTime() !== existingEndAt?.getTime()) changedFields.push('endAt')
    }
    if (allowLateUntil !== undefined) {
      const newAllowLateUntil = allowLateUntil ? new Date(allowLateUntil) : null
      const existingAllowLateUntil = existingTest.allowLateUntil
      if (newAllowLateUntil?.getTime() !== existingAllowLateUntil?.getTime()) changedFields.push('allowLateUntil')
    }
    if (allowCalculator !== undefined && allowCalculator !== existingTest.allowCalculator) changedFields.push('allowCalculator')
    if (allowNoteSheet !== undefined && allowNoteSheet !== existingTest.allowNoteSheet) changedFields.push('allowNoteSheet')
    if (calculatorType !== undefined && calculatorType !== existingTest.calculatorType) changedFields.push('calculatorType')
    if (noteSheetInstructions !== undefined && noteSheetInstructions !== existingTest.noteSheetInstructions) changedFields.push('noteSheetInstructions')
    if (autoApproveNoteSheet !== undefined && autoApproveNoteSheet !== existingTest.autoApproveNoteSheet) changedFields.push('autoApproveNoteSheet')
    if (requireOneSitting !== undefined && requireOneSitting !== existingTest.requireOneSitting) changedFields.push('requireOneSitting')
    if (questions) changedFields.push('questions')

    // Use a transaction to update test and questions
    const updatedTest = await prisma.$transaction(async (tx) => {
      // Update the test
      const test = await tx.eSTest.update({
        where: { id: testId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(instructions !== undefined && { instructions }),
          ...(durationMinutes && { durationMinutes }),
          ...(status && { status }),
          ...(eventId !== undefined && { eventId }),
          ...(startAt !== undefined && { startAt: newStartAt }),
          ...(endAt !== undefined && { endAt: newEndAt }),
          ...(allowLateUntil !== undefined && { allowLateUntil: allowLateUntil ? new Date(allowLateUntil) : null }),
          ...(allowCalculator !== undefined && { allowCalculator }),
          ...(allowNoteSheet !== undefined && { allowNoteSheet }),
          ...(calculatorType !== undefined && { calculatorType: allowCalculator && calculatorType ? calculatorType as 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING' : null }),
          ...(noteSheetInstructions !== undefined && { noteSheetInstructions: allowNoteSheet ? (noteSheetInstructions || null) : null }),
          ...(autoApproveNoteSheet !== undefined && { autoApproveNoteSheet: allowNoteSheet ? (autoApproveNoteSheet ?? true) : true }),
          // Only include requireOneSitting if provided (will be skipped if column doesn't exist)
          ...(requireOneSitting !== undefined ? { requireOneSitting } : {}),
        },
      })

      // Get event name - either from the updated event relation or from existing test
      let finalEventName: string | null = null
      if (eventId !== undefined) {
        // If eventId is being changed, fetch the new event name
        const newEventId = eventId || null
        if (newEventId) {
          const event = await tx.event.findUnique({
            where: { id: newEventId },
            select: { name: true },
          })
          finalEventName = event?.name || null
        } else {
          // eventId is being set to null
          finalEventName = null
        }
      } else {
        // eventId not changed, use existing event name
        finalEventName = existingTest.event?.name || null
        
        // If eventId is null (trial event), try to get eventName from the CREATE audit log
        if (!finalEventName && !existingTest.eventId) {
          const createAudit = await tx.eSTestAudit.findFirst({
            where: {
              testId: testId,
              action: 'CREATE',
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
          if (createAudit && createAudit.details && typeof createAudit.details === 'object' && 'eventName' in createAudit.details) {
            finalEventName = (createAudit.details as any).eventName || null
          }
        }
      }

      // Create audit log for the update
      if (changedFields.length > 0) {
        await tx.eSTestAudit.create({
          data: {
            testId: test.id,
            actorStaffId: editingStaff.id,
            action: 'UPDATE',
            details: {
              changes: changedFields,
              testName: test.name,
              eventName: finalEventName,
            },
          },
        })
      }

      // If questions are provided, update them
      if (questions) {
        // Delete removed questions (questions not in the new array)
        const newQuestionIds = questions.filter(q => q.id).map(q => q.id!)
        await tx.eSTestQuestion.deleteMany({
          where: {
            testId,
            id: { notIn: newQuestionIds },
          },
        })

        // Upsert questions
        for (const q of questions) {
          if (q.id) {
            // Update existing question
            await tx.eSTestQuestion.update({
              where: { id: q.id },
              data: {
                type: q.type,
                promptMd: q.promptMd,
                explanation: q.explanation,
                points: q.points,
                order: q.order,
                shuffleOptions: q.shuffleOptions || false,
                numericTolerance: q.numericTolerance,
              },
            })

            // Handle options
            if (q.options) {
              const newOptionIds = q.options.filter(o => o.id).map(o => o.id!)
              await tx.eSTestQuestionOption.deleteMany({
                where: {
                  questionId: q.id,
                  id: { notIn: newOptionIds },
                },
              })

              for (const opt of q.options) {
                if (opt.id) {
                  await tx.eSTestQuestionOption.update({
                    where: { id: opt.id },
                    data: {
                      label: opt.label,
                      isCorrect: opt.isCorrect,
                      order: opt.order,
                    },
                  })
                } else {
                  await tx.eSTestQuestionOption.create({
                    data: {
                      questionId: q.id,
                      label: opt.label,
                      isCorrect: opt.isCorrect,
                      order: opt.order,
                    },
                  })
                }
              }
            }
          } else {
            // Create new question
            await tx.eSTestQuestion.create({
              data: {
                testId,
                type: q.type,
                promptMd: q.promptMd,
                explanation: q.explanation,
                points: q.points,
                order: q.order,
                shuffleOptions: q.shuffleOptions || false,
                numericTolerance: q.numericTolerance,
                options: q.options && q.options.length > 0
                  ? {
                      create: q.options.map((opt, optIndex) => ({
                        label: opt.label,
                        isCorrect: opt.isCorrect,
                        order: opt.order ?? optIndex,
                      })),
                    }
                  : undefined,
              },
            })
          }
        }
      }

      return test
    })

    // Fetch the complete updated test
    const completeTest = await prisma.eSTest.findUnique({
      where: { id: testId },
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
    })

    return NextResponse.json({ test: completeTest })
  } catch (error) {
    console.error('Error updating ES test:', error)
    return NextResponse.json({ error: 'Failed to update test' }, { status: 500 })
  }
}

// DELETE /api/es/tests - Delete an ES test
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')

    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 })
    }

    // First, get the existing test to check its event
    const existingTest = await prisma.eSTest.findUnique({
      where: { id: testId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!existingTest) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Verify the user has access to this test (check ALL staff memberships to see if any has access to this event)
    const userStaffMemberships = await prisma.tournamentStaff.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { email: { equals: session.user.email, mode: 'insensitive' } },
        ],
        status: 'ACCEPTED',
      },
      include: {
        events: {
          select: {
            eventId: true,
          },
        },
      },
    })

    if (!userStaffMemberships || userStaffMemberships.length === 0) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Check if user is assigned to the same event as the test (collaborative access)
    // OR if user is a tournament director for this tournament
    // User must be assigned to the event in at least one of their staff memberships
    const hasEventAccess = existingTest.eventId && userStaffMemberships.some(staff => 
      staff.events.some(e => e.eventId === existingTest.eventId)
    )

    // Check if user is a tournament director for this tournament
    const isTournamentDirector = await (async () => {
      // Check tournament admin table
      const admin = await prisma.tournamentAdmin.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: existingTest.tournamentId,
            userId: session.user.id,
          },
        },
      })
      if (admin) return true

      // Check if user created the tournament
      const tournament = await prisma.tournament.findUnique({
        where: { id: existingTest.tournamentId },
        select: { createdById: true },
      })
      if (tournament?.createdById === session.user.id) return true

      // Check if user is director on hosting request
      const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
        where: {
          tournament: {
            id: existingTest.tournamentId,
          },
          directorEmail: {
            equals: session.user.email,
            mode: 'insensitive',
          },
          status: 'APPROVED',
        },
      })
      return !!hostingRequest
    })()

    if (!hasEventAccess && !isTournamentDirector) {
      return NextResponse.json({ error: 'Not authorized to delete this test' }, { status: 403 })
    }

    // Get staff member for audit log
    let deletingStaff: { id: string } | null = null
    if (isTournamentDirector) {
      deletingStaff = existingTest.staffId ? { id: existingTest.staffId } : null
    } else if (userStaffMemberships && userStaffMemberships.length > 0) {
      deletingStaff = { id: userStaffMemberships[0].id }
    }

    if (!deletingStaff) {
      return NextResponse.json({ error: 'Could not determine staff member' }, { status: 400 })
    }

    // Get event name - either from event relation or from CREATE audit log for trial events
    let finalEventName: string | null = existingTest.event?.name || null
    if (!finalEventName && !existingTest.eventId) {
      // For trial events, try to get eventName from the CREATE audit log
      const createAudit = await prisma.eSTestAudit.findFirst({
        where: {
          testId: testId,
          action: 'CREATE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      if (createAudit && createAudit.details && typeof createAudit.details === 'object' && 'eventName' in createAudit.details) {
        finalEventName = (createAudit.details as any).eventName || null
      }
    }

    // Create audit log before deletion
    await prisma.eSTestAudit.create({
      data: {
        testId: testId,
        actorStaffId: deletingStaff.id,
        action: 'DELETE',
        details: {
          testName: existingTest.name,
          eventName: finalEventName, // Store event name for deleted tests (including trial events)
          eventId: existingTest.eventId,
          tournamentId: existingTest.tournamentId, // Store for filtering after deletion
        },
      },
    })

    await prisma.eSTest.delete({
      where: { id: testId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting ES test:', error)
    return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 })
  }
}

