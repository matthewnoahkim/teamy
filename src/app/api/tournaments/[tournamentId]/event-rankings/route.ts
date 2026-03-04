import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasESAccess } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getESTestsForUser } from '@/lib/es-tests'

interface RankingRow {
  eventId: string | null
  eventName: string
  eventDivision: string
  testId: string
  testName: string
  rank: number
  participantName: string
  clubName: string
  score: number
  submittedAt: string | null
}

// GET /api/tournaments/[tournamentId]/event-rankings
// Returns participant rankings (1 = highest score) for fully graded tests only.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const resolvedParams = await params
    const tournamentId = resolvedParams.tournamentId

    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 })
    }

    const hasAccess = await hasESAccess(session.user.id, session.user.email, tournamentId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized to view rankings for this tournament' }, { status: 403 })
    }

    const staffMemberships = await getESTestsForUser(session.user.id, session.user.email, {
      includeQuestions: false,
    })

    const membership = staffMemberships.find((m) => m.tournament.id === tournamentId)
    if (!membership) {
      return NextResponse.json(
        { rows: [], fullyGradedTestCount: 0 },
        { headers: { 'Cache-Control': 'private, max-age=15' } },
      )
    }

    const testsById = new Map<string, { eventId: string | null; eventName: string; eventDivision: string; testName: string }>()

    membership.events.forEach((eventAssignment) => {
      const eventTests = eventAssignment.tests as Array<{ id: string; name: string }>
      eventTests.forEach((test) => {
        testsById.set(test.id, {
          eventId: eventAssignment.event.id,
          eventName: eventAssignment.event.name,
          eventDivision: eventAssignment.event.division,
          testName: test.name,
        })
      })
    })

    const testIds = Array.from(testsById.keys())
    if (testIds.length === 0) {
      return NextResponse.json(
        { rows: [], fullyGradedTestCount: 0 },
        { headers: { 'Cache-Control': 'private, max-age=15' } },
      )
    }

    const attempts = await prisma.eSTestAttempt.findMany({
      where: {
        testId: { in: testIds },
        submittedAt: { not: null },
      },
      select: {
        id: true,
        testId: true,
        membershipId: true,
        submittedAt: true,
        createdAt: true,
        gradeEarned: true,
        membership: {
          select: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            club: {
              select: {
                name: true,
              },
            },
          },
        },
        answers: {
          select: {
            gradedAt: true,
            pointsAwarded: true,
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    })

    const attemptsByTest = new Map<string, typeof attempts>()
    attempts.forEach((attempt) => {
      if (!attemptsByTest.has(attempt.testId)) {
        attemptsByTest.set(attempt.testId, [])
      }
      attemptsByTest.get(attempt.testId)!.push(attempt)
    })

    const rows: RankingRow[] = []
    let fullyGradedTestCount = 0

    testsById.forEach((testMeta, testId) => {
      const attemptsForTest = attemptsByTest.get(testId) || []
      if (attemptsForTest.length === 0) {
        return
      }

      const isFullyGraded = attemptsForTest.every((attempt) =>
        attempt.answers.every((answer) => answer.gradedAt !== null),
      )

      if (!isFullyGraded) {
        return
      }

      fullyGradedTestCount += 1

      // Keep only the latest submitted attempt per participant.
      const latestAttemptByMembership = new Map<string, (typeof attemptsForTest)[number]>()
      attemptsForTest.forEach((attempt) => {
        if (!latestAttemptByMembership.has(attempt.membershipId)) {
          latestAttemptByMembership.set(attempt.membershipId, attempt)
        }
      })

      const scoredAttempts = Array.from(latestAttemptByMembership.values())
        .map((attempt) => {
          const fallbackScore = attempt.answers.reduce((sum, answer) => {
            return sum + Number(answer.pointsAwarded ?? 0)
          }, 0)

          return {
            attempt,
            score: attempt.gradeEarned !== null ? Number(attempt.gradeEarned) : fallbackScore,
            participantName:
              attempt.membership.user?.name?.trim() ||
              attempt.membership.user?.email ||
              'Unknown User',
            clubName: attempt.membership.club?.name || 'Unknown Club',
          }
        })
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score
          }
          return a.participantName.localeCompare(b.participantName)
        })

      let currentRank = 0
      let previousScore: number | null = null

      scoredAttempts.forEach((entry, index) => {
        if (previousScore === null || entry.score !== previousScore) {
          currentRank = index + 1
          previousScore = entry.score
        }

        rows.push({
          eventId: testMeta.eventId,
          eventName: testMeta.eventName,
          eventDivision: testMeta.eventDivision,
          testId,
          testName: testMeta.testName,
          rank: currentRank,
          participantName: entry.participantName,
          clubName: entry.clubName,
          score: entry.score,
          submittedAt: entry.attempt.submittedAt?.toISOString() || null,
        })
      })
    })

    rows.sort((a, b) => {
      const eventCompare = a.eventName.localeCompare(b.eventName)
      if (eventCompare !== 0) return eventCompare
      const testCompare = a.testName.localeCompare(b.testName)
      if (testCompare !== 0) return testCompare
      if (a.rank !== b.rank) return a.rank - b.rank
      return a.participantName.localeCompare(b.participantName)
    })

    return NextResponse.json(
      {
        rows,
        fullyGradedTestCount,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15',
        },
      },
    )
  } catch (error) {
    console.error('Error fetching tournament event rankings:', error)
    return NextResponse.json({ error: 'Failed to fetch event rankings' }, { status: 500 })
  }
}
