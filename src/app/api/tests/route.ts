import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin, getUserMembership } from '@/lib/rbac'
import { hashTestPassword } from '@/lib/test-security'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const questionOptionSchema = z.object({
  label: z.string().min(1),
  isCorrect: z.boolean(),
  order: z.number().int().min(0),
})

const questionSchema = z.object({
  type: z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'SHORT_TEXT', 'LONG_TEXT', 'NUMERIC']),
  promptMd: z.string().min(1),
  explanation: z.string().optional(),
  points: z.number().min(0),
  order: z.number().int().min(0),
  sectionId: z.string().optional(),
  shuffleOptions: z.boolean().optional(),
  numericTolerance: z.number().min(0).optional(),
  options: z.array(questionOptionSchema).optional(),
})

const assignmentSchema = z
  .object({
    assignedScope: z.enum(['CLUB', 'TEAM', 'PERSONAL']),
    teamId: z.string().optional(),
    targetMembershipId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.assignedScope === 'TEAM' && !value.teamId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'teamId is required when assignedScope is TEAM',
        path: ['teamId'],
      })
    }
    if (value.assignedScope === 'PERSONAL' && !value.targetMembershipId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'targetMembershipId is required when assignedScope is PERSONAL',
        path: ['targetMembershipId'],
      })
    }
  })

type AssignmentInput = z.infer<typeof assignmentSchema>
type QuestionInput = z.infer<typeof questionSchema>

const createTestSchema = z.object({
  clubId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  instructions: z.string().optional(),
  durationMinutes: z.number().int().min(1).max(720),
  randomizeQuestionOrder: z.boolean().optional(),
  randomizeOptionOrder: z.boolean().optional(),
  requireFullscreen: z.boolean().optional(),
  allowCalculator: z.boolean().optional(),
  calculatorType: z.enum(['FOUR_FUNCTION', 'SCIENTIFIC', 'GRAPHING']).optional().nullable(),
  allowNoteSheet: z.boolean().optional(),
  noteSheetInstructions: z.string().optional().nullable(),
  autoApproveNoteSheet: z.boolean().optional(),
  requireOneSitting: z.boolean().optional(),
  releaseScoresAt: z.string().datetime().optional(),
  maxAttempts: z.number().int().min(1).optional(),
  scoreReleaseMode: z.enum(['NONE', 'SCORE_ONLY', 'SCORE_WITH_WRONG', 'FULL_TEST']).optional(),
  assignments: z.array(assignmentSchema).optional(),
  questions: z.array(questionSchema).optional(),
})

// GET /api/tests?clubId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID is required' }, { status: 400 })
    }

    const membership = await getUserMembership(session.user.id, clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Not a club member' }, { status: 403 })
    }

    const isAdminUser = await isAdmin(session.user.id, clubId)

    // Fetch all tests with their assignments
    const allTests = await prisma.test.findMany({
      where: {
        clubId,
        // Non-admins only see published tests
        ...(!isAdminUser && { status: 'PUBLISHED' }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        durationMinutes: true,
        startAt: true,
        endAt: true,
        allowLateUntil: true,
        requireFullscreen: true,
        allowCalculator: true,
        calculatorType: true,
        allowNoteSheet: true,
        noteSheetInstructions: true,
        requireOneSitting: true,
        releaseScoresAt: true,
        maxAttempts: true,
        scoreReleaseMode: true,
        createdAt: true,
        updatedAt: true,
        createdByMembershipId: true,
        assignments: {
          select: {
            assignedScope: true,
            teamId: true,
            targetMembershipId: true,
            eventId: true,
          },
        },
        _count: {
          select: {
            questions: true,
            attempts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch createdBy memberships for all tests
    const membershipIds = [...new Set(allTests.map(t => t.createdByMembershipId).filter(Boolean))]
    const memberships = membershipIds.length > 0 ? await prisma.membership.findMany({
      where: { id: { in: membershipIds } },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }) : []
    const membershipMap = new Map(memberships.map(m => [m.id, m]))

    // Admins see everything
    if (isAdminUser) {
      // Remove assignments from response and add createdByMembership
      const tests = allTests.map(({ assignments, ...test }) => ({
        ...test,
        createdByMembership: test.createdByMembershipId ? membershipMap.get(test.createdByMembershipId) : undefined,
      }))
      return NextResponse.json({ 
        tests,
        userAttempts: {},
        noteSheets: {},
      })
    }

    // For non-admins, filter tests based on assignments
    // Get user's event IDs from roster
    const userEventAssignments = await prisma.rosterAssignment.findMany({
      where: {
        membershipId: membership.id,
        team: { clubId },
      },
      select: { eventId: true },
    })
    const userEventIds = userEventAssignments.map(ra => ra.eventId)

    // Filter tests - user can see a test if ANY assignment matches
    const filteredTests = allTests.filter(test => {
      // If test has no assignments, user cannot see it
      if (test.assignments.length === 0) {
        return false
      }

      // Check if any assignment grants access
      return test.assignments.some(a => {
        // CLUB scope - everyone gets access
        if (a.assignedScope === 'CLUB') {
          return true
        }
        // Team assignment - user must be in that team
        if (a.teamId && membership.teamId && a.teamId === membership.teamId) {
          return true
        }
        // Personal assignment - must be assigned to this user
        if (a.targetMembershipId === membership.id) {
          return true
        }
        // Event assignment - user must have this event in their roster
        if (a.eventId && userEventIds.includes(a.eventId)) {
          return true
        }
        return false
      })
    })

    // Remove assignments from response and add createdByMembership
    const tests = filteredTests.map(({ assignments, ...test }) => ({
      ...test,
      createdByMembership: test.createdByMembershipId ? membershipMap.get(test.createdByMembershipId) : undefined,
    }))

    // Batch fetch user attempts for all tests (non-admins only, admins don't need this)
    const testIds = tests.map(t => t.id)
    let userAttemptsMap = new Map<string, { attemptsUsed: number; maxAttempts: number | null; hasReachedLimit: boolean }>()
    let noteSheetsMap = new Map<string, { status: string; rejectionReason: string | null }>()

    if (!isAdminUser && testIds.length > 0) {
      // Batch fetch all user attempts in one query
      const attempts = await prisma.testAttempt.groupBy({
        by: ['testId'],
        where: {
          membershipId: membership.id,
          testId: { in: testIds },
          status: {
            in: ['SUBMITTED', 'GRADED'],
          },
        },
        _count: {
          id: true,
        },
      })

      // Create map of testId -> attempt count
      const attemptCounts = new Map(attempts.map(a => [a.testId, a._count.id]))

      // Build userAttemptsMap with maxAttempts from tests
      tests.forEach(test => {
        const attemptsUsed = attemptCounts.get(test.id) || 0
        userAttemptsMap.set(test.id, {
          attemptsUsed,
          maxAttempts: test.maxAttempts,
          hasReachedLimit: test.maxAttempts !== null && attemptsUsed >= test.maxAttempts,
        })
      })

      // Batch fetch note sheets for tests that allow them and have startAt
      const testsWithNoteSheets = tests.filter(t => t.allowNoteSheet && t.startAt)
      if (testsWithNoteSheets.length > 0) {
        const noteSheets = await prisma.noteSheet.findMany({
          where: {
            membershipId: membership.id,
            testId: { in: testsWithNoteSheets.map(t => t.id) },
          },
          select: {
            testId: true,
            status: true,
            rejectionReason: true,
          },
        })

        noteSheets.forEach(ns => {
          if (ns.testId) {
            noteSheetsMap.set(ns.testId, {
              status: ns.status,
              rejectionReason: ns.rejectionReason,
            })
          }
        })
      }
    }

    return NextResponse.json({ 
      tests,
      userAttempts: Object.fromEntries(userAttemptsMap),
      noteSheets: Object.fromEntries(noteSheetsMap),
    })
  } catch (error) {
    console.error('Get tests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tests
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createTestSchema.parse(body)

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, validatedData.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can create tests' },
        { status: 403 }
      )
    }

    // Get membership ID
    const membership = await getUserMembership(session.user.id, validatedData.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const {
      assignments,
      questions,
      clubId,
      name,
      description,
      instructions,
      durationMinutes,
      randomizeQuestionOrder,
      randomizeOptionOrder,
      requireFullscreen,
      allowCalculator,
      calculatorType,
      allowNoteSheet,
      noteSheetInstructions,
      autoApproveNoteSheet,
      requireOneSitting,
      releaseScoresAt,
      maxAttempts,
      scoreReleaseMode,
    } = validatedData

    const createdTest = await prisma.$transaction(async (tx) => {
      const baseTest = await tx.test.create({
        data: {
          clubId,
          name,
          description,
          instructions,
          status: 'DRAFT',
          durationMinutes,
          randomizeQuestionOrder: randomizeQuestionOrder ?? false,
          randomizeOptionOrder: randomizeOptionOrder ?? false,
          requireFullscreen: requireFullscreen ?? true,
          allowCalculator: allowCalculator ?? false,
          calculatorType: allowCalculator ? (calculatorType ?? 'FOUR_FUNCTION') : null,
          allowNoteSheet: allowNoteSheet ?? false,
          noteSheetInstructions: allowNoteSheet ? (noteSheetInstructions ?? null) : null,
          autoApproveNoteSheet: allowNoteSheet ? (autoApproveNoteSheet ?? true) : true,
          requireOneSitting: requireOneSitting ?? true,
          releaseScoresAt: releaseScoresAt ? new Date(releaseScoresAt) : null,
          maxAttempts: maxAttempts ?? null,
          scoreReleaseMode: (scoreReleaseMode ?? 'FULL_TEST') as any,
          createdByMembershipId: membership.id,
        },
      })

      const assignmentPayload: AssignmentInput[] =
        assignments && assignments.length > 0
          ? assignments
          : [{ assignedScope: 'CLUB', teamId: undefined, targetMembershipId: undefined }]

      await tx.testAssignment.createMany({
        data: assignmentPayload.map((assignment) => ({
          testId: baseTest.id,
          assignedScope: assignment.assignedScope,
          teamId: assignment.teamId ?? null,
          targetMembershipId: assignment.targetMembershipId ?? null,
        })),
      })

      if (questions && questions.length > 0) {
        for (const question of questions) {
          const createdQuestion = await tx.question.create({
            data: {
              testId: baseTest.id,
              sectionId: question.sectionId,
              type: question.type,
              promptMd: question.promptMd,
              explanation: question.explanation,
              points: new Prisma.Decimal(question.points),
              order: question.order,
              shuffleOptions: question.shuffleOptions ?? false,
              numericTolerance:
                question.numericTolerance !== undefined
                  ? new Prisma.Decimal(question.numericTolerance)
                  : undefined,
            },
          })

          if (question.options && question.options.length > 0) {
            await tx.questionOption.createMany({
              data: question.options.map((opt) => ({
                questionId: createdQuestion.id,
                label: opt.label,
                isCorrect: opt.isCorrect,
                order: opt.order,
              })),
            })
          }
        }
      }

      await tx.testAudit.create({
        data: {
          testId: baseTest.id,
          actorMembershipId: membership.id,
          action: 'CREATE',
          details: { 
            testName: baseTest.name,
            clubId: baseTest.clubId, // Store clubId for querying after deletion
          },
        },
      })

      return tx.test.findUniqueOrThrow({
        where: { id: baseTest.id },
        include: {
          assignments: true,
          questions: {
            orderBy: { order: 'asc' },
            include: {
              options: {
                orderBy: { order: 'asc' },
              },
            },
          },
          _count: {
            select: {
              questions: true,
              attempts: true,
            },
          },
        },
      })
    })

    return NextResponse.json({ test: createdTest }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Create test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
