import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ViewResultsClient, type ResultAttempt } from '@/components/tests/view-results-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle } from 'lucide-react'

interface TournamentTestResultsPageProps {
  params: Promise<{ testId: string }>
}

type ScoreReleaseMode = 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST'

export default async function TournamentTestResultsPage({
  params,
}: TournamentTestResultsPageProps) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const testId = resolvedParams.testId

  const [esTest, tournamentTest] = await Promise.all([
    prisma.eSTest.findUnique({
      where: { id: testId },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        status: true,
        releaseScoresAt: true,
        scoreReleaseMode: true,
        scoresReleased: true,
      },
    }),
    prisma.tournamentTest.findFirst({
      where: { testId },
      include: {
        tournament: {
          select: {
            id: true,
          },
        },
        test: {
          select: {
            id: true,
            name: true,
            status: true,
            releaseScoresAt: true,
            scoreReleaseMode: true,
          },
        },
      },
    }),
  ])

  const isESTest = Boolean(esTest)
  const tournamentId = isESTest ? esTest?.tournamentId : tournamentTest?.tournament.id

  if (!tournamentId) {
    notFound()
  }

  const testName = isESTest ? esTest!.name : tournamentTest!.test.name
  const releaseScoresAt = isESTest
    ? esTest!.releaseScoresAt
    : tournamentTest!.test.releaseScoresAt
  const scoreReleaseMode = (isESTest
    ? esTest!.scoreReleaseMode
    : tournamentTest!.test.scoreReleaseMode) || 'FULL_TEST'
  const scoresReleasedField = isESTest ? esTest!.scoresReleased : false

  // Match access checks used by /testing/tests/[testId]/take.
  const userMemberships = await prisma.membership.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      clubId: true,
      teamId: true,
    },
  })

  const teamIds = userMemberships
    .map((membership) => membership.teamId)
    .filter((id): id is string => id !== null)
  const clubIds = userMemberships.map((membership) => membership.clubId)

  const registration = await prisma.tournamentRegistration.findFirst({
    where: {
      tournamentId,
      status: 'CONFIRMED',
      OR: [
        { teamId: { in: teamIds } },
        { clubId: { in: clubIds } },
      ],
    },
    select: {
      clubId: true,
      teamId: true,
    },
  })

  if (!registration) {
    redirect('/testing')
  }

  const membership = registration.teamId
    ? userMemberships.find(
        (entry) => entry.clubId === registration.clubId && entry.teamId === registration.teamId
      )
    : userMemberships.find((entry) => entry.clubId === registration.clubId)

  if (!membership) {
    redirect('/testing')
  }

  const attempt = isESTest
    ? await prisma.eSTestAttempt.findFirst({
        where: {
          membershipId: membership.id,
          testId,
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
    : await prisma.testAttempt.findFirst({
        where: {
          membershipId: membership.id,
          testId,
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
      <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
        <div className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>No Results Found</CardTitle>
              <CardDescription>You have not submitted any attempts for this test yet.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild>
                <Link href="/testing">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Testing Portal
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const now = new Date()
  let scoresReleased = false
  if (scoresReleasedField === true) {
    scoresReleased = true
  } else if (releaseScoresAt) {
    const releaseDate = releaseScoresAt instanceof Date ? releaseScoresAt : new Date(releaseScoresAt)
    if (!Number.isNaN(releaseDate.getTime())) {
      scoresReleased = now.getTime() >= (releaseDate.getTime() - 1000)
    }
  }

  if (!scoresReleased) {
    return (
      <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
        <div className="container mx-auto max-w-2xl">
          <Card className="border-orange-300/60">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle>Results Not Yet Available</CardTitle>
              <CardDescription>
                {releaseScoresAt
                  ? `Results will be released on ${new Date(releaseScoresAt).toLocaleString()}.`
                  : 'Results will be released once tournament staff makes them available.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild variant="outline">
                <Link href="/testing">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Testing Portal
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const sortedAnswers = [...attempt.answers].sort((a, b) => a.question.order - b.question.order)

  const attemptRecord = {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt?.toISOString() || null,
    submittedAt: attempt.submittedAt?.toISOString() || null,
    gradeEarned: attempt.gradeEarned ? Number(attempt.gradeEarned) : null,
    proctoringScore:
      'proctoringScore' in attempt && attempt.proctoringScore
        ? Number(attempt.proctoringScore)
        : null,
    tabSwitchCount:
      'tabSwitchCount' in attempt && typeof attempt.tabSwitchCount === 'number'
        ? attempt.tabSwitchCount
        : 0,
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
        order: answer.question.order,
        options: answer.question.options.map((option) => ({
          id: option.id,
          label: option.label,
          isCorrect: scoresReleased ? option.isCorrect : undefined,
          order: option.order,
        })),
      },
    })),
  }

  let filteredAttempt: unknown = attemptRecord
  if (scoreReleaseMode === 'NONE') {
    filteredAttempt = {
      ...attemptRecord,
      gradeEarned: null,
      proctoringScore: null,
      answers: null,
    }
  } else if (scoreReleaseMode === 'SCORE_ONLY') {
    filteredAttempt = {
      ...attemptRecord,
      answers: null,
    }
  } else if (scoreReleaseMode === 'SCORE_WITH_WRONG') {
    filteredAttempt = {
      ...attemptRecord,
      answers: attemptRecord.answers.filter((answer) => {
        const questionPoints = answer.question.points
        const earnedPoints = answer.pointsAwarded || 0
        return earnedPoints < questionPoints
      }),
    }
  }

  return (
    <ViewResultsClient
      testId={testId}
      testName={testName}
      attempt={filteredAttempt as ResultAttempt}
      testSettings={{
        releaseScoresAt: releaseScoresAt ?? null,
        scoreReleaseMode: scoreReleaseMode as ScoreReleaseMode,
      }}
    />
  )
}
