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

    // Get all event IDs that the user is assigned to
    const userEventIds = new Set<string>()
    staffMemberships.forEach(membership => {
      membership.events.forEach(e => userEventIds.add(e.event.id))
    })

    console.log('Fetching ES tests for user:', session.user.email)
    console.log('User event IDs:', Array.from(userEventIds))
    console.log('User tournament IDs:', staffMemberships.map(m => m.tournament.id))

    // First, let's check ALL tests in the tournaments to see what exists
    const tournamentIds = staffMemberships.map(m => m.tournament.id)
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
    // This returns ALL tests for events the user is assigned to, regardless of who created them
    // IMPORTANT: We don't filter by staffId - all staff assigned to an event can see all tests for that event
    const eventIdsArray = Array.from(userEventIds)
    console.log('Querying tests with:', { tournamentIds, eventIdsArray })
    
    const allTests = await prisma.eSTest.findMany({
      where: {
        tournamentId: { in: tournamentIds },
        ...(eventIdsArray.length > 0 ? { eventId: { in: eventIdsArray } } : {}),
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

    // Organize tests by tournament and event
    const testsByTournament = new Map<string, Map<string, typeof allTests>>()
    
    for (const test of allTests) {
      if (!test.eventId) {
        console.log('Skipping test without eventId:', test.id, test.name)
        continue
      }
      
      if (!testsByTournament.has(test.tournamentId)) {
        testsByTournament.set(test.tournamentId, new Map())
      }
      const testsByEvent = testsByTournament.get(test.tournamentId)!
      
      if (!testsByEvent.has(test.eventId)) {
        testsByEvent.set(test.eventId, [])
      }
      testsByEvent.get(test.eventId)!.push(test)
    }
    
    console.log('Tests organized by tournament:', Array.from(testsByTournament.keys()))
    for (const [tournamentId, eventMap] of testsByTournament.entries()) {
      console.log(`Tournament ${tournamentId} has tests for events:`, Array.from(eventMap.keys()))
      for (const [eventId, tests] of eventMap.entries()) {
        console.log(`  Event ${eventId} has ${tests.length} tests:`, tests.map(t => t.name))
      }
    }

    // Get hosting request divisions for all tournaments
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

    // Map staff memberships with tests organized by event
    // For each event assignment, look for tests in ANY tournament the user has access to
    // (not just the membership's tournament) - this enables cross-tournament test visibility
    const staffMembershipsWithTests = staffMemberships.map(membership => {
      // Use hosting request division for display if available (supports "B&C")
      const displayDivision = hostingRequestMap.get(membership.tournament.id) || membership.tournament.division
      
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
        events: [...membership.events].sort((a, b) => a.event.name.localeCompare(b.event.name)).map(e => {
          // Look for tests for this event across ALL tournaments the user has access to
          // This allows tests to be visible to all ESs assigned to the same event, even if they're in different tournament memberships
          let eventTests: typeof allTests = []
          for (const [tournamentId, eventMap] of testsByTournament.entries()) {
            // Check if user has access to this tournament (they should, since testsByTournament only contains their tournaments)
            // and if there are tests for this event in this tournament
            const testsForEventInTournament = eventMap.get(e.event.id) || []
            eventTests = [...eventTests, ...testsForEventInTournament]
          }
          console.log(`Mapping tests for membership ${membership.id}, tournament ${membership.tournament.id}, event ${e.event.id}:`, eventTests.length, 'tests')
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
    const { staffId, tournamentId, eventId, name, description, instructions, durationMinutes, questions } = body as {
      staffId: string
      tournamentId: string
      eventId?: string
      name: string
      description?: string
      instructions?: string
      durationMinutes?: number
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
      const createdTest = await tx.eSTest.create({
        data: {
          staffId,
          createdByStaffId: staffId, // Track original creator
          tournamentId,
          eventId: eventId || null, // Ensure we store null if not provided
          name,
          description,
          instructions,
          durationMinutes: durationMinutes || 60,
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

      // Create audit log for test creation
      await tx.eSTestAudit.create({
        data: {
          testId: createdTest.id,
          actorStaffId: staffId,
          action: 'CREATE',
          details: {
            testName: createdTest.name,
            eventId: eventId || null,
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
    const { testId, name, description, instructions, durationMinutes, status, eventId, questions } = body as {
      testId: string
      name?: string
      description?: string
      instructions?: string
      durationMinutes?: number
      status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
      eventId?: string
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

    // Track what fields are being changed for audit log
    const changedFields: string[] = []
    if (name && name !== existingTest.name) changedFields.push('name')
    if (description !== undefined && description !== existingTest.description) changedFields.push('description')
    if (instructions !== undefined && instructions !== existingTest.instructions) changedFields.push('instructions')
    if (durationMinutes && durationMinutes !== existingTest.durationMinutes) changedFields.push('durationMinutes')
    if (status && status !== existingTest.status) changedFields.push('status')
    if (eventId !== undefined && eventId !== existingTest.eventId) changedFields.push('eventId')
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
        },
      })

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
              eventName: existingTest.event?.name,
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

    // Create audit log before deletion
    await prisma.eSTestAudit.create({
      data: {
        testId: testId,
        actorStaffId: deletingStaff.id,
        action: 'DELETE',
        details: {
          testName: existingTest.name,
          eventName: existingTest.event?.name, // Store event name for deleted tests
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

