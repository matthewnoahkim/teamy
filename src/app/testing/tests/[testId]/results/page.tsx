import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ViewResultsClient } from '@/components/tests/view-results-client'

export default async function TournamentTestResultsPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const testId = resolvedParams.testId

  // Find the ESTest (query without new fields that might not exist yet)
  const esTest = await prisma.eSTest.findUnique({
    where: { id: testId },
    select: {
      id: true,
      name: true,
      tournamentId: true,
      status: true,
    },
  })

  if (!esTest) {
    notFound()
  }

  // Safely access new fields that might not exist yet
  const releaseScoresAt = (esTest as any).releaseScoresAt
  const scoreReleaseMode = (esTest as any).scoreReleaseMode || 'FULL_TEST'
  const scoresReleasedField = (esTest as any).scoresReleased

  // Find user's membership through tournament registration
  const registration = await prisma.tournamentRegistration.findFirst({
    where: {
      tournamentId: esTest.tournamentId,
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
    redirect('/testing')
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
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Results Found</h1>
          <p className="text-muted-foreground">
            You have not submitted any attempts for this test yet.
          </p>
        </div>
      </div>
    )
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

  if (!scoresReleased) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Results Not Yet Available</h1>
          <p className="text-muted-foreground">
            {releaseScoresAt
              ? `Results will be released on ${new Date(releaseScoresAt).toLocaleString()}.`
              : 'Results will be released once the tournament director makes them available.'}
          </p>
        </div>
      </div>
    )
  }

  // Sort answers by question order
  const sortedAnswers = attempt.answers.sort((a, b) => a.question.order - b.question.order)

  // Transform attempt data
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
  let filteredAttempt = attemptData
  if (scoreReleaseMode === 'NONE') {
    filteredAttempt = {
      ...attemptData,
      gradeEarned: null,
      proctoringScore: null,
      answers: null as any,
    }
  } else if (scoreReleaseMode === 'SCORE_ONLY') {
    filteredAttempt = {
      ...attemptData,
      answers: null as any,
    }
  } else if (scoreReleaseMode === 'SCORE_WITH_WRONG') {
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

  return (
    <ViewResultsClient
      testId={esTest.id}
      testName={esTest.name}
      attempt={filteredAttempt}
      testSettings={{
        releaseScoresAt: releaseScoresAt ? (typeof releaseScoresAt === 'string' ? releaseScoresAt : releaseScoresAt.toISOString()) : null,
        scoreReleaseMode: scoreReleaseMode,
      }}
    />
  )
}
