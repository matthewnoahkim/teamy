import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership } from '@/lib/rbac'
import { z } from 'zod'

const schema = z.object({
  questionId: z.string(),
})

// POST /api/tests/[testId]/attempts/[attemptId]/timed-reveal
// Records the server-side timestamp when a timed question is revealed.
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
    const { questionId } = schema.parse(body)
    const now = new Date()

    // Try regular TestAttempt first
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: resolvedParams.attemptId },
      include: { test: true },
    })

    if (attempt) {
      if (attempt.testId !== resolvedParams.testId) {
        return NextResponse.json({ error: 'Attempt does not belong to this test' }, { status: 400 })
      }

      const membership = await getUserMembership(session.user.id, attempt.test.clubId)
      if (!membership || membership.id !== attempt.membershipId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      if (attempt.status !== 'IN_PROGRESS') {
        return NextResponse.json({ error: 'Attempt is not in progress' }, { status: 400 })
      }

      // Only set revealedAt if not already set (prevent re-reveal)
      const existing = await prisma.attemptAnswer.findUnique({
        where: {
          attemptId_questionId: {
            attemptId: resolvedParams.attemptId,
            questionId,
          },
        },
      })

      if (existing?.timedRevealedAt) {
        return NextResponse.json({ revealedAt: existing.timedRevealedAt.toISOString() })
      }

      const answer = await prisma.attemptAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: resolvedParams.attemptId,
            questionId,
          },
        },
        update: { timedRevealedAt: now },
        create: {
          attemptId: resolvedParams.attemptId,
          questionId,
          timedRevealedAt: now,
        },
      })

      return NextResponse.json({ revealedAt: answer.timedRevealedAt!.toISOString() })
    }

    // Try ESTestAttempt
    const esAttempt = await prisma.eSTestAttempt.findUnique({
      where: { id: resolvedParams.attemptId },
      include: {
        test: {
          include: { tournament: { select: { id: true } } },
        },
      },
    })

    if (!esAttempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    if (esAttempt.testId !== resolvedParams.testId) {
      return NextResponse.json({ error: 'Attempt does not belong to this test' }, { status: 400 })
    }

    if (esAttempt.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Attempt is not in progress' }, { status: 400 })
    }

    const userMemberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
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

    const membership = (registration.teamId
      ? userMemberships.find((m) => m.clubId === registration.clubId && m.teamId === registration.teamId)
      : userMemberships.find((m) => m.clubId === registration.clubId)) ?? null

    if (!membership || membership.id !== esAttempt.membershipId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const existing = await prisma.eSTestAttemptAnswer.findUnique({
      where: {
        attemptId_questionId: {
          attemptId: resolvedParams.attemptId,
          questionId,
        },
      },
    })

    if (existing?.timedRevealedAt) {
      return NextResponse.json({ revealedAt: existing.timedRevealedAt.toISOString() })
    }

    const answer = await prisma.eSTestAttemptAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: resolvedParams.attemptId,
          questionId,
        },
      },
      update: { timedRevealedAt: now },
      create: {
        attemptId: resolvedParams.attemptId,
        questionId,
        timedRevealedAt: now,
      },
    })

    return NextResponse.json({ revealedAt: answer.timedRevealedAt!.toISOString() })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Timed reveal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
