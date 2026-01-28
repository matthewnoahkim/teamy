import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/es/tests/[testId]/my-results
// Get the current user's latest ESTest results
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const testId = resolvedParams.testId

    // Query without new fields that might not exist yet (if migration hasn't run)
    const test = await prisma.eSTest.findUnique({
      where: { id: testId },
      select: {
        id: true,
        tournamentId: true,
        status: true,
      },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Safely access new fields that might not exist yet
    const releaseScoresAt = (test as any).releaseScoresAt
    const scoreReleaseMode = (test as any).scoreReleaseMode || 'FULL_TEST'
    const scoresReleasedField = (test as any).scoresReleased

    // Find user's membership through tournament registration
    const registration = await prisma.tournamentRegistration.findFirst({
      where: {
        tournamentId: test.tournamentId,
        registeredById: session.user.id,
        status: 'CONFIRMED',
      },
      include: {
        club: {
          include: {
            memberships: {
              where: {
                userId: session.user.id,
              },
            },
          },
        },
      },
    })

    if (!registration || !registration.club.memberships.length) {
      return NextResponse.json({ error: 'Not registered for this tournament' }, { status: 403 })
    }

    const membership = registration.club.memberships[0]

    // Get the latest submitted/graded attempt for this user
    const attempt = await prisma.eSTestAttempt.findFirst({
      where: {
        membershipId: membership.id,
        testId: testId,
        status: {
          in: ['SUBMITTED', 'GRADED'],
        },
      },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    })

    if (!attempt) {
      return NextResponse.json({ error: 'No attempt found' }, { status: 404 })
    }

    // Check if scores should be released
    const now = new Date()
    let scoresReleased = false
    if (scoresReleasedField === true) {
      scoresReleased = true
    } else if (releaseScoresAt) {
      const releaseDate = releaseScoresAt instanceof Date ? releaseScoresAt : new Date(releaseScoresAt)
      scoresReleased = now >= releaseDate
    }

    // Sort answers by question order
    const sortedAnswers = attempt.answers.sort((a, b) => a.question.order - b.question.order)

    // Transform attempt data
    const attemptData = {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt?.toISOString() || null,
      submittedAt: attempt.submittedAt?.toISOString() || null,
      gradeEarned: scoresReleased ? (attempt.gradeEarned ? Number(attempt.gradeEarned) : null) : null,
      proctoringScore: scoresReleased ? (attempt.proctoringScore ? Number(attempt.proctoringScore) : null) : null,
      tabSwitchCount: attempt.tabSwitchCount || 0,
      answers: sortedAnswers.map((answer) => ({
        id: answer.id,
        questionId: answer.questionId,
        answerText: answer.answerText,
        selectedOptionIds: answer.selectedOptionIds,
        numericAnswer: answer.numericAnswer ? Number(answer.numericAnswer) : null,
        pointsAwarded: scoresReleased ? (answer.pointsAwarded ? Number(answer.pointsAwarded) : null) : null,
        gradedAt: answer.gradedAt?.toISOString() || null,
        graderNote: answer.graderNote,
        question: {
          id: answer.question.id,
          promptMd: answer.question.promptMd,
          type: answer.question.type,
          points: Number(answer.question.points),
          explanation: scoresReleased ? answer.question.explanation : null,
          options: answer.question.options.map((opt) => ({
            id: opt.id,
            label: opt.label,
            isCorrect: scoresReleased ? opt.isCorrect : undefined,
          })),
        },
      })),
    }

    // Apply score release mode filtering
    let filteredAttempt: typeof attemptData & { answers: typeof attemptData.answers | null } = attemptData
    if (!scoresReleased) {
      // Hide all score-related information
      filteredAttempt = {
        ...attemptData,
        gradeEarned: null,
        proctoringScore: null,
        answers: attemptData.answers.map((answer) => ({
          ...answer,
          pointsAwarded: null,
          question: {
            ...answer.question,
            explanation: null,
            options: answer.question.options.map((opt) => ({
              ...opt,
              isCorrect: undefined,
            })),
          },
        })),
      }
    } else if (scoreReleaseMode === 'NONE') {
      // NONE mode - don't release anything
      filteredAttempt = {
        ...attemptData,
        gradeEarned: null,
        proctoringScore: null,
        answers: null as any,
      }
    } else if (scoreReleaseMode === 'SCORE_ONLY') {
      // SCORE_ONLY - show only the score
      filteredAttempt = {
        ...attemptData,
        answers: null as any,
      }
    } else if (scoreReleaseMode === 'SCORE_WITH_WRONG') {
      // SCORE_WITH_WRONG - show score and wrong answers only
      filteredAttempt = {
        ...attemptData,
        answers: attemptData.answers.filter((answer) => {
          const questionPoints = answer.question.points
          const earnedPoints = answer.pointsAwarded || 0
          return earnedPoints < questionPoints
        }),
      }
    }
    // FULL_TEST mode shows everything (no filtering needed)

    return NextResponse.json({
      attempt: filteredAttempt,
      test: {
        releaseScoresAt: releaseScoresAt ? (typeof releaseScoresAt === 'string' ? releaseScoresAt : releaseScoresAt.toISOString()) : null,
        scoreReleaseMode: scoreReleaseMode,
        scoresReleased: scoresReleased,
      },
    })
  } catch (error) {
    console.error('Get ESTest my-results error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
