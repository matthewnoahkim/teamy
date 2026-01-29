import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership } from '@/lib/rbac'
import { Prisma } from '@prisma/client'
import { Role } from '@prisma/client'
import { z } from 'zod'

// Reuse the exact same schemas from /api/tests/route.ts
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

const createTestSchema = z.object({
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
  releaseScoresAt: z.string().datetime().optional(),
  maxAttempts: z.number().int().min(1).optional(),
  scoreReleaseMode: z.enum(['NONE', 'SCORE_ONLY', 'SCORE_WITH_WRONG', 'FULL_TEST']).optional(),
  questions: z.array(questionSchema).optional(),
})

type QuestionInput = z.infer<typeof questionSchema>

// Helper to check if user is tournament admin
async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  
  if (admin) return true
  
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  return tournament?.createdById === userId
}

// POST /api/tournaments/[tournamentId]/tests/create
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is tournament admin
    const isAdmin = await isTournamentAdmin(session.user.id, resolvedParams.tournamentId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only tournament admins can create tests' }, { status: 403 })
    }

    // Get tournament info
    const tournament = await prisma.tournament.findUnique({
      where: { id: resolvedParams.tournamentId },
      select: {
        id: true,
        division: true,
        createdById: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Find a club to use (tests require a clubId, but we'll handle it internally)
    // Use the current user's first admin club matching the tournament division
    const userMembership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        role: Role.ADMIN,
        club: {
          division: tournament.division,
        },
      },
      select: {
        clubId: true,
      },
    })

    if (!userMembership) {
      return NextResponse.json({ 
        error: 'You need at least one club in the tournament division to create tests' 
      }, { status: 400 })
    }

    const clubId = userMembership.clubId

    // Get membership for the test creation
    const membership = await getUserMembership(session.user.id, clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const body = await req.json()
    const validatedData = createTestSchema.parse(body)

    const {
      questions,
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
      releaseScoresAt,
      maxAttempts,
      scoreReleaseMode,
    } = validatedData

    // Create the test using the same transaction pattern as /api/tests
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
          releaseScoresAt: releaseScoresAt ? new Date(releaseScoresAt) : null,
          maxAttempts: maxAttempts ?? null,
          scoreReleaseMode: (scoreReleaseMode ?? 'FULL_TEST') as any,
          createdByMembershipId: membership.id,
        },
      })

      // Create questions if provided
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

      // Create audit log
      await tx.testAudit.create({
        data: {
          testId: baseTest.id,
          actorMembershipId: membership.id,
          action: 'CREATE',
          details: { testName: baseTest.name },
        },
      })

      // Automatically link the test to the tournament
      await tx.tournamentTest.create({
        data: {
          tournamentId: resolvedParams.tournamentId,
          testId: baseTest.id,
        },
      })

      return tx.test.findUniqueOrThrow({
        where: { id: baseTest.id },
        include: {
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
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Create tournament test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
