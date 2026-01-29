import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership } from '@/lib/rbac'
import { z } from 'zod'

const saveAnswerSchema = z.object({
  questionId: z.string(),
  answerText: z.string().optional().nullable(),
  selectedOptionIds: z.array(z.string()).optional().nullable(),
  numericAnswer: z.number().optional().nullable(),
  markedForReview: z.boolean().optional(),
})

// POST /api/tests/[testId]/attempts/[attemptId]/answers
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; attemptId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = saveAnswerSchema.parse(body)

    // Try to find as TestAttempt first
    let attempt = await prisma.testAttempt.findUnique({
      where: { id: resolvedParams.attemptId },
      include: {
        test: true,
      },
    })

    let isESTest = false
    let membership: any = null

    if (attempt) {
      // Verify ownership - check if user is a member of the club and owns this attempt
      membership = await getUserMembership(session.user.id, attempt.test.clubId)
      if (!membership || membership.id !== attempt.membershipId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Verify question belongs to this test
      const question = await prisma.question.findFirst({
        where: {
          id: validatedData.questionId,
          testId: resolvedParams.testId,
        },
      })

      if (!question) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      }

      if (attempt.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          { error: 'Cannot modify submitted attempt' },
          { status: 400 }
        )
      }

      // Upsert answer for regular Test
      const updateData: any = {
        answerText: validatedData.answerText,
        selectedOptionIds: validatedData.selectedOptionIds ?? undefined,
        numericAnswer: validatedData.numericAnswer,
      }
      
      if (validatedData.markedForReview !== undefined) {
        updateData.markedForReview = validatedData.markedForReview
      }

      const answer = await prisma.attemptAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: resolvedParams.attemptId,
            questionId: validatedData.questionId,
          },
        },
        update: updateData,
        create: {
          attemptId: resolvedParams.attemptId,
          questionId: validatedData.questionId,
          answerText: validatedData.answerText,
          selectedOptionIds: validatedData.selectedOptionIds ?? undefined,
          numericAnswer: validatedData.numericAnswer,
          markedForReview: validatedData.markedForReview ?? false,
        },
      })

      return NextResponse.json({ answer })
    } else {
      // Try to find as ESTestAttempt
      const esAttempt = await prisma.eSTestAttempt.findUnique({
        where: { id: resolvedParams.attemptId },
        include: {
          test: {
            include: {
              tournament: {
                select: { id: true },
              },
            },
          },
        },
      })

      if (!esAttempt) {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
      }

      isESTest = true

      // For ESTest, verify membership through tournament registration
      const userMemberships = await prisma.membership.findMany({
        where: { userId: session.user.id },
        include: {
          club: { select: { id: true } },
          team: { select: { id: true } },
        },
      })

      const teamIds = userMemberships.map((m) => m.teamId).filter((id): id is string => id !== null)
      const clubIds = userMemberships.map((m) => m.clubId)

      const registration = await prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId: esAttempt.test.tournament.id,
          status: 'CONFIRMED',
          OR: [{ teamId: { in: teamIds } }, { clubId: { in: clubIds } }],
        },
      })

      if (!registration) {
        return NextResponse.json({ error: 'Not registered for this tournament' }, { status: 403 })
      }

      membership = registration.teamId
        ? userMemberships.find((m) => m.clubId === registration.clubId && m.teamId === registration.teamId)
        : userMemberships.find((m) => m.clubId === registration.clubId)

      if (!membership || membership.id !== esAttempt.membershipId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      if (esAttempt.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          { error: 'Cannot modify submitted attempt' },
          { status: 400 }
        )
      }

      // Verify question belongs to this ESTest
      const esQuestion = await prisma.eSTestQuestion.findFirst({
        where: {
          id: validatedData.questionId,
          testId: resolvedParams.testId,
        },
      })

      if (!esQuestion) {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 })
      }

      // Upsert answer for ESTest
      const updateData: any = {
        answerText: validatedData.answerText,
        selectedOptionIds: validatedData.selectedOptionIds ?? undefined,
        numericAnswer: validatedData.numericAnswer,
      }
      
      if (validatedData.markedForReview !== undefined) {
        updateData.markedForReview = validatedData.markedForReview
      }

      const answer = await prisma.eSTestAttemptAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: resolvedParams.attemptId,
            questionId: validatedData.questionId,
          },
        },
        update: updateData,
        create: {
          attemptId: resolvedParams.attemptId,
          questionId: validatedData.questionId,
          answerText: validatedData.answerText,
          selectedOptionIds: validatedData.selectedOptionIds ?? undefined,
          numericAnswer: validatedData.numericAnswer,
          markedForReview: validatedData.markedForReview ?? false,
        },
      })

      return NextResponse.json({ answer })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Save answer error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
