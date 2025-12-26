import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

// GET /api/td/tournaments/[tournamentId]/tests
// Get all ES tests for a tournament, organized by event
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> | { tournamentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params if it's a Promise (Next.js 15 compatibility)
    // In Next.js 15, params is always a Promise, but we handle both for compatibility
    const resolvedParams = await Promise.resolve(params)
    const tournamentId = resolvedParams.tournamentId

    if (!tournamentId) {
      console.error('Missing tournamentId in params:', resolvedParams)
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 })
    }

    // Check if user is tournament director
    const isTD = await isTournamentDirector(session.user.id, session.user.email, tournamentId)
    if (!isTD) {
      return NextResponse.json({ error: 'Only tournament directors can view tests' }, { status: 403 })
    }

    // Get tournament info to get division and eventsRun
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { 
        division: true,
        eventsRun: true,
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

    // Organize tests by event
    const testsByEvent = new Map<string, typeof allTests>()
    
    for (const test of allTests) {
      if (!test.eventId) {
        // Skip tests without event assignment
        continue
      }
      
      if (!testsByEvent.has(test.eventId)) {
        testsByEvent.set(test.eventId, [])
      }
      testsByEvent.get(test.eventId)!.push(test)
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
        questions: test.questions.map(q => ({
          id: q.id,
          type: q.type,
          promptMd: q.promptMd,
          explanation: q.explanation,
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
    }))

    return NextResponse.json({ events: eventsWithTests })
  } catch (error) {
    console.error('Error fetching TD tournament tests:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    // tournamentId is in scope here, so we can use it
    const currentTournamentId = params instanceof Promise ? (await params).tournamentId : params.tournamentId
    console.error('Error details:', { errorMessage, errorStack, tournamentId: currentTournamentId })
    return NextResponse.json({ 
      error: 'Failed to fetch tests',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}

