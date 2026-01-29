import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTournamentAdmin, hasESTestAccess } from '@/lib/rbac'

// GET /api/es/tests/[testId]/attempts - Get all attempts for an ESTest (tournament director/admin only)
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



    const test = await prisma.eSTest.findUnique({
      where: { id: resolvedParams.testId },
      select: { tournamentId: true },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user is tournament admin or has access to this specific test
    // TDs have full access, ES only for their assigned events
    const isAdmin = await isTournamentAdmin(session.user.id, test.tournamentId)
    const hasAccess = await hasESTestAccess(session.user.id, session.user.email || '', resolvedParams.testId)
    
    if (!isAdmin && !hasAccess) {
      return NextResponse.json(
        { error: 'Only tournament directors, event supervisors, and admins can view test attempts' },
        { status: 403 }
      )
    }

    const attempts = await prisma.eSTestAttempt.findMany({
      where: { testId: resolvedParams.testId },
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
      orderBy: [
        { submittedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Fetch memberships and users separately
    const membershipIds = [...new Set(attempts.map(a => a.membershipId))]
    const memberships = await prisma.membership.findMany({
      where: { id: { in: membershipIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Create a map for quick lookup
    const membershipMap = new Map(memberships.map(m => [m.id, m]))

    // Sort answers by question order
    const attemptsWithSortedAnswers = attempts.map((attempt) => ({
      ...attempt,
      answers: attempt.answers.sort((a, b) => a.question.order - b.question.order),
    }))

    // Transform to match client interface
    const transformedAttempts = attemptsWithSortedAnswers.map((attempt) => {
      const membership = membershipMap.get(attempt.membershipId)
      
      return {
        id: attempt.id,
        membershipId: attempt.membershipId,
        status: attempt.status,
        startedAt: attempt.startedAt?.toISOString() || null,
        submittedAt: attempt.submittedAt?.toISOString() || null,
        gradeEarned: attempt.gradeEarned ? Number(attempt.gradeEarned) : null,
        proctoringScore: attempt.proctoringScore ? Number(attempt.proctoringScore) : null,
        tabSwitchCount: attempt.tabSwitchCount || 0,
        timeOffPageSeconds: attempt.timeOffPageSeconds || 0,
        user: membership?.user
          ? {
              id: membership.user.id,
              name: membership.user.name,
              email: membership.user.email,
            }
          : null,
        club: membership?.club
          ? {
              id: membership.club.id,
              name: membership.club.name,
            }
          : null,
        proctorEvents: attempt.proctorEvents.map((event) => ({
          id: event.id,
          kind: event.kind,
          ts: event.ts.toISOString(),
          meta: event.meta,
        })),
        answers: attempt.answers.map((answer) => ({
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
            explanation: answer.question.explanation,
            options: answer.question.options.map((opt) => ({
              id: opt.id,
              label: opt.label,
              isCorrect: opt.isCorrect,
            })),
          },
        })),
      }
    })

    return NextResponse.json({ attempts: transformedAttempts })
  } catch (error) {
    console.error('Get ESTest attempts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
