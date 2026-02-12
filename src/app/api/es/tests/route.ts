import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CalculatorType, Prisma } from '@prisma/client'
import { hasESAccess, hasESTestAccess } from '@/lib/rbac'
import { getESTestsForUser } from '@/lib/es-tests'

// Helper to check if user is a tournament director for a tournament
async function _isTournamentDirector(userId: string, userEmail: string, tournamentId: string): Promise<boolean> {
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

    // Check query parameter for including questions (default: true for backward compatibility)
    const { searchParams } = new URL(request.url)
    const includeQuestions = searchParams.get('includeQuestions') !== 'false'

    const staffMembershipsWithTests = await getESTestsForUser(
      session.user.id,
      session.user.email,
      { includeQuestions }
    )

    return NextResponse.json(
      { staffMemberships: staffMembershipsWithTests },
      {
        headers: {
          'Cache-Control': 'private, max-age=30', // Cache for 30 seconds
        },
      }
    )
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
      requireFullscreen,
      allowCalculator,
      allowNoteSheet,
      calculatorType,
      noteSheetInstructions,
      autoApproveNoteSheet,
      requireOneSitting,
      maxAttempts,
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
      requireFullscreen?: boolean
      allowCalculator?: boolean
      allowNoteSheet?: boolean
      calculatorType?: CalculatorType
      noteSheetInstructions?: string
      autoApproveNoteSheet?: boolean
      requireOneSitting?: boolean
      maxAttempts?: number
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
      const baseData: Record<string, unknown> = {
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
        requireFullscreen: requireFullscreen !== undefined ? requireFullscreen : true,
        allowCalculator: allowCalculator ?? false,
        allowNoteSheet: allowNoteSheet ?? false,
        calculatorType: allowCalculator && calculatorType ? calculatorType as 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING' : null,
        noteSheetInstructions: allowNoteSheet ? (noteSheetInstructions || null) : null,
        autoApproveNoteSheet: allowNoteSheet ? (autoApproveNoteSheet ?? true) : true,
        maxAttempts: maxAttempts ?? null,
      }
      
      const createdTest = await tx.eSTest.create({
        data: {
          ...(baseData as Prisma.ESTestCreateInput),
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
      requireFullscreen,
      allowCalculator,
      allowNoteSheet,
      calculatorType,
      noteSheetInstructions,
      autoApproveNoteSheet,
      requireOneSitting,
      maxAttempts,
      releaseScoresAt,
      scoreReleaseMode,
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
      requireFullscreen?: boolean
      allowCalculator?: boolean
      allowNoteSheet?: boolean
      calculatorType?: CalculatorType
      noteSheetInstructions?: string
      autoApproveNoteSheet?: boolean
      requireOneSitting?: boolean
      maxAttempts?: number
      releaseScoresAt?: string
      scoreReleaseMode?: 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST'
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
    // Use select to avoid fields that might not exist yet (if migration hasn't run)
    const existingTest = await prisma.eSTest.findUnique({
      where: { id: testId },
      select: {
        id: true,
        name: true,
        description: true,
        instructions: true,
        status: true,
        durationMinutes: true,
        tournamentId: true,
        staffId: true,
        eventId: true,
        startAt: true,
        endAt: true,
        allowLateUntil: true,
        requireFullscreen: true,
        allowCalculator: true,
        allowNoteSheet: true,
        calculatorType: true,
        noteSheetInstructions: true,
        autoApproveNoteSheet: true,
        requireOneSitting: true,
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

    // Check if user has ES access (TD or ES) for this tournament
    const hasAccess = await hasESAccess(session.user.id, session.user.email, existingTest.tournamentId)
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get the staff member who is making the edit
    let editingStaff: { id: string } | null = null
    
    // Find a staff membership for this user in this tournament
    if (userStaffMemberships && userStaffMemberships.length > 0) {
      // Use the first matching staff membership
      editingStaff = { id: userStaffMemberships[0].id }
    } else {
      // Fallback to test's current staff if no membership found
      editingStaff = existingTest.staffId ? { id: existingTest.staffId } : null
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
    if (requireFullscreen !== undefined) {
      const currentRequireFullscreen = existingTest.requireFullscreen ?? true
      if (requireFullscreen !== currentRequireFullscreen) changedFields.push('requireFullscreen')
    }
    if (allowCalculator !== undefined && allowCalculator !== existingTest.allowCalculator) changedFields.push('allowCalculator')
    if (allowNoteSheet !== undefined && allowNoteSheet !== existingTest.allowNoteSheet) changedFields.push('allowNoteSheet')
    if (calculatorType !== undefined && calculatorType !== existingTest.calculatorType) changedFields.push('calculatorType')
    if (noteSheetInstructions !== undefined && noteSheetInstructions !== existingTest.noteSheetInstructions) changedFields.push('noteSheetInstructions')
    if (autoApproveNoteSheet !== undefined && autoApproveNoteSheet !== existingTest.autoApproveNoteSheet) changedFields.push('autoApproveNoteSheet')
    if (requireOneSitting !== undefined && requireOneSitting !== existingTest.requireOneSitting) changedFields.push('requireOneSitting')
    if (maxAttempts !== undefined && maxAttempts !== (existingTest as Record<string, unknown>).maxAttempts) changedFields.push('maxAttempts')
    if (questions) changedFields.push('questions')

    // If publishing, fetch tournament default settings to apply
    let _tournamentDefaults: Record<string, unknown> | null = null
    if (status === 'PUBLISHED') {
      const tournament = await prisma.tournament.findUnique({
        where: { id: existingTest.tournamentId },
        select: {
          defaultDurationMinutes: true,
          defaultStartAt: true,
          defaultEndAt: true,
          defaultReleaseScoresAt: true,
          defaultScoreReleaseMode: true,
          defaultRequireFullscreen: true,
          defaultAllowCalculator: true,
          defaultCalculatorType: true,
          defaultAllowNoteSheet: true,
          defaultAutoApproveNoteSheet: true,
          defaultRequireOneSitting: true,
          defaultMaxAttempts: true,
        },
      })
      _tournamentDefaults = tournament
    }

    // Use a transaction to update test and questions
    const _updatedTest = await prisma.$transaction(async (tx) => {
      // Build update data
      const updateData: Record<string, unknown> = {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(instructions !== undefined && { instructions }),
        ...(durationMinutes && { durationMinutes }),
        ...(status && { status }),
        ...(eventId !== undefined && { eventId }),
        ...(startAt !== undefined && { startAt: newStartAt }),
        ...(endAt !== undefined && { endAt: newEndAt }),
          ...(allowLateUntil !== undefined && { allowLateUntil: allowLateUntil ? new Date(allowLateUntil) : null }),
          ...(requireFullscreen !== undefined && { requireFullscreen }),
          ...(allowCalculator !== undefined && { allowCalculator }),
          ...(allowNoteSheet !== undefined && { allowNoteSheet }),
          ...(calculatorType !== undefined && { calculatorType: allowCalculator && calculatorType ? calculatorType as 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING' : null }),
          ...(noteSheetInstructions !== undefined && { noteSheetInstructions: allowNoteSheet ? (noteSheetInstructions || null) : null }),
          ...(autoApproveNoteSheet !== undefined && { autoApproveNoteSheet: allowNoteSheet ? (autoApproveNoteSheet ?? true) : true }),
          ...(releaseScoresAt !== undefined && { releaseScoresAt: releaseScoresAt ? new Date(releaseScoresAt) : null }),
          ...(scoreReleaseMode !== undefined && { scoreReleaseMode: scoreReleaseMode as 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST' | null }),
          // Only include requireOneSitting if provided (will be skipped if column doesn't exist)
          ...(requireOneSitting !== undefined ? { requireOneSitting } : {}),
          // Only include maxAttempts if provided (will be skipped if column doesn't exist)
          ...(maxAttempts !== undefined ? { maxAttempts: maxAttempts ?? null } : {}),
      }

      // Note: Tournament defaults are no longer automatically applied on publish.
      // Users must explicitly click "Apply Defaults" button in the UI to apply them.

      // Update the test
      const test = await tx.eSTest.update({
        where: { id: testId },
        data: updateData,
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
            finalEventName = (createAudit.details as Record<string, unknown>).eventName as string || null
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
    // Use select to avoid fields that might not exist yet (if migration hasn't run)
    const completeTest = await prisma.eSTest.findUnique({
      where: { id: testId },
      select: {
        id: true,
        name: true,
        description: true,
        instructions: true,
        status: true,
        durationMinutes: true,
        tournamentId: true,
        eventId: true,
        startAt: true,
        endAt: true,
        allowLateUntil: true,
        requireFullscreen: true,
        allowCalculator: true,
        allowNoteSheet: true,
        calculatorType: true,
        noteSheetInstructions: true,
        autoApproveNoteSheet: true,
        requireOneSitting: true,
        createdAt: true,
        updatedAt: true,
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
    // Use select to avoid fields that might not exist yet (if migration hasn't run)
    const existingTest = await prisma.eSTest.findUnique({
      where: { id: testId },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        staffId: true,
        eventId: true,
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

    // Check if user has access to this specific test
    // TDs have full access, ES only for their assigned events
    const hasAccess = await hasESTestAccess(session.user.id, session.user.email, testId)

    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized to delete this test' }, { status: 403 })
    }

    // Get staff member for audit log
    let deletingStaff: { id: string } | null = null
    if (userStaffMemberships && userStaffMemberships.length > 0) {
      deletingStaff = { id: userStaffMemberships[0].id }
    } else {
      deletingStaff = existingTest.staffId ? { id: existingTest.staffId } : null
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
        finalEventName = (createAudit.details as Record<string, unknown>).eventName as string || null
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

