import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasESAccess } from '@/lib/rbac'

// GET /api/td/tournaments/[tournamentId]/tests
// Get all ES tests for a tournament, organized by event
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  const tournamentId = resolvedParams.tournamentId
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!tournamentId) {
      console.error('Missing tournamentId in params:', resolvedParams)
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 })
    }

    // Check if user is tournament director or event supervisor
    const hasAccess = await hasESAccess(session.user.id, session.user.email, tournamentId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Only tournament directors and event supervisors can view tests' }, { status: 403 })
    }

    // Get tournament info to get division, eventsRun, and trialEvents
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        division: true,
        eventsRun: true,
        trialEvents: true,
        hostingRequest: {
          select: {
            division: true,
          },
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Get display division from hosting request (supports "B&C"), fallback to tournament division
    const displayDivision = tournament.hostingRequest?.division || tournament.division || 'C'
    
    // Ensure displayDivision is a valid value
    if (!displayDivision || (displayDivision !== 'B' && displayDivision !== 'C' && displayDivision !== 'B&C')) {
      console.error('Invalid division value:', displayDivision, 'for tournament:', tournamentId)
      return NextResponse.json({ error: 'Invalid tournament division' }, { status: 400 })
    }

    // Fetch all ES tests for this tournament
    // Use select instead of include to avoid fetching columns that don't exist in the database
    // (allowCalculator, allowNoteSheet, calculatorType, noteSheetInstructions may not exist yet)
    let allTests
    try {
      allTests = await prisma.eSTest.findMany({
        where: {
          tournamentId: tournamentId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          instructions: true,
          durationMinutes: true,
          status: true,
          eventId: true,
          startAt: true,
          endAt: true,
          allowLateUntil: true,
          allowCalculator: true,
          calculatorType: true,
          allowNoteSheet: true,
          noteSheetInstructions: true,
          autoApproveNoteSheet: true,
          requireOneSitting: true,
          updatedAt: true,
          createdAt: true,
        event: {
          select: {
            id: true,
            name: true,
            division: true,
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
          select: {
            id: true,
            type: true,
            promptMd: true,
            explanation: true,
            points: true,
            order: true,
            shuffleOptions: true,
            numericTolerance: true,
            options: {
              select: {
                id: true,
                label: true,
                isCorrect: true,
                order: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    } catch (error: any) {
      // If requireOneSitting column doesn't exist, try without it
      // P2022 is PrismaClientValidationError for unknown fields
      if (error?.code === 'P2022' || error?.message?.includes('requireOneSitting') || error?.message?.includes('Unknown field')) {
        console.warn('requireOneSitting column not found, fetching without it. Error:', error?.message || error)
        allTests = await prisma.eSTest.findMany({
          where: {
            tournamentId: tournamentId,
          },
          select: {
            id: true,
            name: true,
            description: true,
            instructions: true,
            durationMinutes: true,
            status: true,
            eventId: true,
            startAt: true,
            endAt: true,
            allowLateUntil: true,
            allowCalculator: true,
            calculatorType: true,
            allowNoteSheet: true,
            noteSheetInstructions: true,
            autoApproveNoteSheet: true,
            // requireOneSitting: true, // Column doesn't exist yet
            updatedAt: true,
            createdAt: true,
            event: {
              select: {
                id: true,
                name: true,
                division: true,
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
              select: {
                id: true,
                type: true,
                promptMd: true,
                explanation: true,
                points: true,
                order: true,
                shuffleOptions: true,
                numericTolerance: true,
                options: {
                  select: {
                    id: true,
                    label: true,
                    isCorrect: true,
                    order: true,
                  },
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { updatedAt: 'desc' },
        })
      } else {
        // Re-throw if it's a different error
        console.error('Error fetching tests:', error)
        return NextResponse.json(
          { error: error?.message || 'Failed to fetch tests' },
          { status: 500 }
        )
      }
    }

    // Get trial events from tournament
    const trialEvents: Array<{ name: string; division: 'B' | 'C' }> = []
    if (tournament.trialEvents) {
      try {
        const parsed = JSON.parse(tournament.trialEvents)
        if (Array.isArray(parsed)) {
          // Handle both old format (string[]) and new format ({ name, division }[])
          if (parsed.length > 0 && typeof parsed[0] === 'string') {
            // Old format - use tournament division
            trialEvents.push(...parsed.map((name: string) => ({ name, division: displayDivision as 'B' | 'C' })))
          } else {
            // New format
            trialEvents.push(...parsed.map((e: any) => ({ name: e.name, division: e.division || displayDivision })))
          }
        }
      } catch (e) {
        console.error('Error parsing trialEvents:', e)
      }
    }
    const trialEventNames = trialEvents.map(e => e.name)
    const trialEventDivisionMap = new Map(trialEvents.map(e => [e.name, e.division]))

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

    // Organize tests by event
    // For regular events, use eventId as key
    // For trial events, use "trial-{eventName}" as key
    const testsByEvent = new Map<string, typeof allTests>()
    
    for (const test of allTests) {
      let eventKey: string
      if (test.eventId) {
        // Regular event - use eventId as key
        eventKey = test.eventId
      } else {
        // Trial event - use eventName from audit log
        const eventName = testEventNameMap.get(test.id)
        if (eventName && trialEventNames.includes(eventName)) {
          eventKey = `trial-${eventName}`
        } else {
          // Skip if eventName not found or doesn't match any configured trial event
          continue
        }
      }
      
      if (!testsByEvent.has(eventKey)) {
        testsByEvent.set(eventKey, [])
      }
      testsByEvent.get(eventKey)!.push(test)
    }

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

    // Get all events for this division - handle B&C tournaments
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
      // Combine and sort
      events = [...bEvents, ...cEvents].sort((a, b) => a.name.localeCompare(b.name))
    } else {
      // For single division tournaments, use displayDivision (which handles the B&C case)
      // Convert displayDivision to the proper type ('B' or 'C')
      const division = displayDivision === 'B' || displayDivision === 'C' ? displayDivision : tournament.division
      events = await prisma.event.findMany({
        where: {
          division: division as 'B' | 'C',
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

    // Build response with events and their tests
    const eventsWithTests = events.map(event => ({
      event: {
        id: event.id,
        name: event.name,
        division: event.division,
      },
      tests: (testsByEvent.get(event.id) || []).map(test => ({
        id: test.id,
        name: test.name,
        description: test.description,
        instructions: test.instructions,
        durationMinutes: test.durationMinutes,
        status: test.status,
        eventId: test.eventId,
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
        updatedAt: test.updatedAt.toISOString(),
        createdAt: test.createdAt.toISOString(),
        allowNoteSheet: test.allowNoteSheet ?? false,
        autoApproveNoteSheet: test.autoApproveNoteSheet ?? true,
        requireOneSitting: (test as any).requireOneSitting ?? true, // Default to true if column doesn't exist
        questions: test.questions.map((q: any) => ({
          id: q.id,
          type: q.type,
          promptMd: q.promptMd,
          explanation: q.explanation,
          points: Number(q.points),
          order: q.order,
          options: q.options.map((o: any) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
            order: o.order,
          })),
        })),
      })),
    }))

    // Add trial events with their tests
    const trialEventsWithTests = trialEvents.map(trialEvent => ({
      event: {
        id: null,
        name: trialEvent.name,
        division: trialEvent.division,
      },
      tests: (testsByEvent.get(`trial-${trialEvent.name}`) || []).map(test => ({
        id: test.id,
        name: test.name,
        description: test.description,
        instructions: test.instructions,
        durationMinutes: test.durationMinutes,
        status: test.status,
        eventId: test.eventId,
        event: null, // Trial events don't have event relation
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
        updatedAt: test.updatedAt.toISOString(),
        createdAt: test.createdAt.toISOString(),
        allowNoteSheet: test.allowNoteSheet ?? false,
        autoApproveNoteSheet: test.autoApproveNoteSheet ?? true,
        requireOneSitting: (test as any).requireOneSitting ?? true, // Default to true if column doesn't exist
        questions: test.questions.map((q: any) => ({
          id: q.id,
          type: q.type,
          promptMd: q.promptMd,
          explanation: q.explanation,
          points: Number(q.points),
          order: q.order,
          options: q.options.map((o: any) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
            order: o.order,
          })),
        })),
      })),
    }))

    // Combine regular events and trial events, sorted by name
    const allEventsWithTests = [...eventsWithTests, ...trialEventsWithTests].sort((a, b) => 
      a.event.name.localeCompare(b.event.name)
    )

    return NextResponse.json({ events: allEventsWithTests })
  } catch (error) {
    console.error('Error fetching TD tournament tests:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack, tournamentId })
    return NextResponse.json({ 
      error: 'Failed to fetch tests',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}
