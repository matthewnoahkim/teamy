import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isTournamentDirector } from '@/lib/rbac'
import { upsertTournamentTrialEvent } from '@/lib/tournament-trial-events'
import { Prisma, Role, ScoreReleaseMode } from '@prisma/client'
import { z } from 'zod'
import { serverSession } from '@/lib/server-session'

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
  eventId: z.string().optional(),
  eventName: z.string().trim().min(1).max(200).optional(),
  trialEventDivision: z.enum(['B', 'C']).optional().nullable(),
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

type _QuestionInput = z.infer<typeof questionSchema>

// POST /api/tournaments/[tournamentId]/tests/create
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await serverSession.get()
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasDirectorAccess = await isTournamentDirector(
      session.user.id,
      session.user.email,
      resolvedParams.tournamentId,
    )
    if (!hasDirectorAccess) {
      return NextResponse.json({ error: 'Only tournament directors can create tests' }, { status: 403 })
    }

    // Get tournament info
    const tournament = await prisma.tournament.findUnique({
      where: { id: resolvedParams.tournamentId },
      select: {
        id: true,
        division: true,
        createdById: true,
        trialEvents: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Tournament tests still require a backing club membership.
    // Prefer a same-division admin club, but fall back to any admin club so invited TDs can create tests too.
    const userMembership =
      await prisma.membership.findFirst({
        where: {
          userId: session.user.id,
          role: Role.ADMIN,
          club: {
            division: tournament.division,
          },
        },
        select: {
          id: true,
          clubId: true,
        },
      }) ??
      await prisma.membership.findFirst({
        where: {
          userId: session.user.id,
          role: Role.ADMIN,
        },
        select: {
          id: true,
          clubId: true,
        },
      })

    if (!userMembership) {
      return NextResponse.json({ 
        error: 'You need at least one admin club to create tests' 
      }, { status: 400 })
    }

    const clubId = userMembership.clubId

    const body = await req.json()
    const validatedData = createTestSchema.parse(body)

    const {
      questions,
      name,
      description,
      instructions,
      eventId,
      eventName,
      trialEventDivision,
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

    let resolvedEventName: string | null = null
    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          name: true,
          division: true,
        },
      })

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      if (event.division !== tournament.division) {
        return NextResponse.json(
          { error: 'Event does not match tournament division' },
          { status: 400 }
        )
      }

      resolvedEventName = event.name
    } else if (eventName) {
      resolvedEventName = eventName.trim()
    }

    // Create the test using the same transaction pattern as /api/tests
    const createdTest = await prisma.$transaction(async (tx) => {
      if (!eventId && resolvedEventName) {
        await tx.tournament.update({
          where: { id: resolvedParams.tournamentId },
          data: {
            trialEvents: upsertTournamentTrialEvent(
              tournament.trialEvents,
              {
                name: resolvedEventName,
                division: trialEventDivision ?? tournament.division,
              },
              tournament.division,
            ),
          },
        })
      }

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
          scoreReleaseMode: (scoreReleaseMode ?? 'FULL_TEST') as ScoreReleaseMode,
          createdByMembershipId: userMembership.id,
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
          actorMembershipId: userMembership.id,
          action: 'CREATE',
          details: {
            testName: baseTest.name,
            eventId: eventId ?? null,
            eventName: resolvedEventName,
          },
        },
      })

      // Automatically link the test to the tournament
      await tx.tournamentTest.create({
        data: {
          tournamentId: resolvedParams.tournamentId,
          testId: baseTest.id,
          eventId: eventId ?? undefined,
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
