import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership } from '@/lib/rbac'
import { getClientIp, autoGradeQuestion, calculateProctoringScore } from '@/lib/test-security'
import { z } from 'zod'

const submitSchema = z.object({
  clientFingerprint: z.string().optional(),
  timeRemaining: z.number().optional(),
})

// POST /api/tests/[testId]/attempts/[attemptId]/submit
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
    const validatedData = submitSchema.parse(body)

    // Try to find as TestAttempt first
    let attempt = await prisma.testAttempt.findUnique({
      where: { id: resolvedParams.attemptId },
      include: {
        test: {
          include: {
            questions: {
              include: {
                options: true,
              },
            },
          },
        },
        answers: true,
        proctorEvents: true,
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
    } else {
      // Try to find as ESTestAttempt
      const esAttempt = await prisma.eSTestAttempt.findUnique({
        where: { id: resolvedParams.attemptId },
        include: {
          test: {
            include: {
              tournament: { select: { id: true } },
              questions: {
                include: {
                  options: { orderBy: { order: 'asc' } },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
          answers: true,
          proctorEvents: true,
        },
      })

      if (!esAttempt) {
        return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
      }

      isESTest = true
      attempt = esAttempt as any

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
    }

    // TypeScript safety check (logically this should never happen due to the 404 return above)
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Attempt already submitted' },
        { status: 400 }
      )
    }

    // Auto-grade all objective questions
    const gradingResults = attempt.test.questions.map((question) => {
      const answer = attempt.answers.find((a) => a.questionId === question.id)
      if (!answer) {
        return { questionId: question.id, pointsAwarded: 0, needsManualGrade: false }
      }

      // Check if needs manual grading
      // Fill-in-the-blank questions (SHORT_TEXT with [blank] or [blank1], [blank2], etc. markers) can be auto-graded
      const isFillInTheBlank = question.type === 'SHORT_TEXT' && question.promptMd && /\[blank\d*\]/.test(question.promptMd)
      if ((question.type === 'SHORT_TEXT' && !isFillInTheBlank) || question.type === 'LONG_TEXT') {
        return { questionId: question.id, pointsAwarded: 0, needsManualGrade: true }
      }

      // Auto-grade
      const result = autoGradeQuestion(
        {
          type: question.type,
          points: Number(question.points),
          numericTolerance: question.numericTolerance ? Number(question.numericTolerance) : null,
          promptMd: question.promptMd || null,
          explanation: question.explanation || null,
          options: question.options,
        },
        {
          selectedOptionIds: answer.selectedOptionIds as string[] | undefined,
          numericAnswer: answer.numericAnswer ? Number(answer.numericAnswer) : null,
          answerText: answer.answerText || null,
        }
      )

      return {
        questionId: question.id,
        pointsAwarded: result.pointsAwarded,
        needsManualGrade: false,
      }
    })

    // Calculate total grade (only from auto-graded questions)
    const totalAutoGraded = gradingResults
      .filter((r) => !r.needsManualGrade)
      .reduce((sum, r) => sum + r.pointsAwarded, 0)

    // Calculate proctoring score from proctorEvents
    const proctoringScore = calculateProctoringScore((attempt as any).proctorEvents || [])

    // Get IP at submit
    const ipAtSubmit = getClientIp(req.headers)

    // Update attempt and answers in transaction
    await prisma.$transaction(async (tx) => {
      if (isESTest) {
        // Get current tab tracking values from the attempt
        const esAttemptData = await tx.eSTestAttempt.findUnique({
          where: { id: resolvedParams.attemptId },
          select: { tabSwitchCount: true, timeOffPageSeconds: true },
        })
        
        // Update ESTestAttempt
        await tx.eSTestAttempt.update({
          where: { id: resolvedParams.attemptId },
          data: {
            status: gradingResults.some((r) => r.needsManualGrade) ? 'SUBMITTED' : 'GRADED',
            submittedAt: new Date(),
            gradeEarned: totalAutoGraded,
            proctoringScore,
            ipAtSubmit,
            // Preserve tab tracking values if they exist
            tabSwitchCount: esAttemptData?.tabSwitchCount ?? 0,
            timeOffPageSeconds: esAttemptData?.timeOffPageSeconds ?? 0,
          },
        })

        // Create or update answer records for all questions
        for (const result of gradingResults) {
          await tx.eSTestAttemptAnswer.upsert({
            where: {
              attemptId_questionId: {
                attemptId: resolvedParams.attemptId,
                questionId: result.questionId,
              },
            },
            update: {
              pointsAwarded: result.pointsAwarded,
              gradedAt: result.needsManualGrade ? null : new Date(),
            },
            create: {
              attemptId: resolvedParams.attemptId,
              questionId: result.questionId,
              answerText: null,
              selectedOptionIds: undefined,
              numericAnswer: null,
              pointsAwarded: result.pointsAwarded,
              gradedAt: result.needsManualGrade ? null : new Date(),
            },
          })
        }
      } else {
        // Update TestAttempt
        await tx.testAttempt.update({
          where: { id: resolvedParams.attemptId },
          data: {
            status: gradingResults.some((r) => r.needsManualGrade) ? 'SUBMITTED' : 'GRADED',
            submittedAt: new Date(),
            gradeEarned: totalAutoGraded,
            proctoringScore,
            ipAtSubmit,
          },
        })

        // Create or update answer records for all questions
        for (const result of gradingResults) {
          await tx.attemptAnswer.upsert({
            where: {
              attemptId_questionId: {
                attemptId: resolvedParams.attemptId,
                questionId: result.questionId,
              },
            },
            update: {
              pointsAwarded: result.pointsAwarded,
              gradedAt: result.needsManualGrade ? null : new Date(),
            },
            create: {
              attemptId: resolvedParams.attemptId,
              questionId: result.questionId,
              answerText: null,
              selectedOptionIds: undefined,
              numericAnswer: null,
              pointsAwarded: result.pointsAwarded,
              gradedAt: result.needsManualGrade ? null : new Date(),
            },
          })
        }
      }
    })

    // Fetch updated attempt
    const updatedAttempt = isESTest
      ? await prisma.eSTestAttempt.findUnique({
          where: { id: resolvedParams.attemptId },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        })
      : await prisma.testAttempt.findUnique({
          where: { id: resolvedParams.attemptId },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
            proctorEvents: true,
          },
        })

    return NextResponse.json({
      attempt: updatedAttempt,
      needsManualGrading: gradingResults.some((r) => r.needsManualGrade),
      proctoringScore,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Submit attempt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

