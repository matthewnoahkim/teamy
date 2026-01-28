import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { ViewResultsClient } from '@/components/tests/view-results-client'
import { filterAttemptByReleaseMode } from '@/lib/test-security'

export default async function TestResultsPage({
  params,
}: {
  params: Promise<{ clubId: string; testId: string }>
}) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const membership = await getUserMembership(session.user.id, resolvedParams.clubId)
  if (!membership) {
    redirect('/no-clubs')
  }

  // Check if user is admin
  const isAdminUser = await isAdmin(session.user.id, resolvedParams.clubId)

  const test = await prisma.test.findFirst({
    where: {
      id: resolvedParams.testId,
      clubId: resolvedParams.clubId,
    },
    select: {
      id: true,
      name: true,
      releaseScoresAt: true,
      scoreReleaseMode: true,
      status: true,
    },
  })

  if (!test) {
    notFound()
  }

  const attempt = await prisma.testAttempt.findFirst({
    where: {
      membershipId: membership.id,
      testId: resolvedParams.testId,
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
        options: answer.question.options.map((opt) => ({
          id: opt.id,
          label: opt.label,
          isCorrect: opt.isCorrect,
          order: opt.order,
        })),
      },
    })),
  }

  const filteredAttemptData = filterAttemptByReleaseMode(
    attemptData,
    {
      scoreReleaseMode: (test.scoreReleaseMode || 'FULL_TEST') as 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST',
      releaseScoresAt: test.releaseScoresAt,
      status: test.status,
    },
    isAdminUser
  )

  return (
    <ViewResultsClient
      testId={test.id}
      testName={test.name}
      attempt={filteredAttemptData}
      testSettings={{
        releaseScoresAt: test.releaseScoresAt,
        scoreReleaseMode: test.scoreReleaseMode || 'FULL_TEST',
      }}
    />
  )
}


