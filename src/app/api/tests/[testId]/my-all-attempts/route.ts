import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { shouldReleaseScores, filterAttemptByReleaseMode } from '@/lib/test-security'

// GET /api/tests/[testId]/my-all-attempts
// Get all of the current user's test attempts
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

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        clubId: true,
        releaseScoresAt: true,
        scoreReleaseMode: true,
        status: true,
      },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    const membership = await getUserMembership(session.user.id, test.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    const isAdminUser = await isAdmin(session.user.id, test.clubId)

    // Get all submitted/graded attempts for this user
    const attempts = await prisma.testAttempt.findMany({
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
        proctorEvents: {
          orderBy: {
            ts: 'asc',
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    })

    // Transform and filter each attempt
    const transformedAttempts = attempts.map((attempt) => {
      // Sort answers by question order
      const sortedAnswers = attempt.answers.sort((a, b) => a.question.order - b.question.order)

      const attemptData = {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt?.toISOString() || null,
        submittedAt: attempt.submittedAt?.toISOString() || null,
        gradeEarned: attempt.gradeEarned ? Number(attempt.gradeEarned) : null,
        proctoringScore: attempt.proctoringScore ? Number(attempt.proctoringScore) : null,
        tabSwitchCount: attempt.tabSwitchCount || 0,
        answers: sortedAnswers.map((answer) => ({
          id: answer.id,
          questionId: answer.questionId,
          answerText: answer.answerText,
          selectedOptionIds: answer.selectedOptionIds,
          numericAnswer: answer.numericAnswer ? Number(answer.numericAnswer) : null,
          pointsAwarded: answer.pointsAwarded ? Number(answer.pointsAwarded) : null,
          gradedAt: answer.gradedAt?.toISOString() || null,
          graderNote: answer.graderNote,
          question: {
            id: answer.question.id,
            promptMd: answer.question.promptMd,
            type: answer.question.type,
            points: Number(answer.question.points),
            sectionId: answer.question.sectionId,
            order: answer.question.order,
            explanation: answer.question.explanation,
            options: answer.question.options.map((opt) => ({
              id: opt.id,
              label: opt.label,
              isCorrect: opt.isCorrect,
              order: opt.order,
            })),
          },
        })),
      }

      // Apply score release filtering
      // Use FULL_TEST as default (matches schema default) if scoreReleaseMode is null/undefined
      return filterAttemptByReleaseMode(
        attemptData,
        {
          scoreReleaseMode: (test.scoreReleaseMode || 'FULL_TEST') as 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST',
          releaseScoresAt: test.releaseScoresAt,
          status: test.status,
        },
        isAdminUser
      )
    })

    return NextResponse.json({
      attempts: transformedAttempts,
      test: {
        id: test.id,
        releaseScoresAt: test.releaseScoresAt?.toISOString() || null,
        scoreReleaseMode: test.scoreReleaseMode || 'FULL_TEST',
        scoresReleased: shouldReleaseScores({
          releaseScoresAt: test.releaseScoresAt,
          status: test.status,
        }),
      },
    })
  } catch (error) {
    console.error('Get my all attempts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

