import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const gradeAnswerSchema = z.object({
  answerId: z.string(),
  pointsAwarded: z.number().min(0),
  graderNote: z.string().optional(),
})

const gradeAttemptSchema = z.object({
  grades: z.array(gradeAnswerSchema),
})

// Helper to check if user has access to grade an ES test
async function hasESGradingAccess(userId: string, userEmail: string, testId: string): Promise<boolean> {
  const test = await prisma.eSTest.findUnique({
    where: { id: testId },
    select: { tournamentId: true, eventId: true },
  })

  if (!test) return false

  // Check if user is a tournament director
  const isTD = await (async () => {
    const admin = await prisma.tournamentAdmin.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: test.tournamentId,
          userId,
        },
      },
    })
    if (admin) return true

    const tournament = await prisma.tournament.findUnique({
      where: { id: test.tournamentId },
      select: { createdById: true },
    })
    if (tournament?.createdById === userId) return true

    const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
      where: {
        tournament: { id: test.tournamentId },
        directorEmail: { equals: userEmail, mode: 'insensitive' },
        status: 'APPROVED',
      },
    })
    return !!hostingRequest
  })()

  if (isTD) return true

  // Check if user is ES assigned to this event
  const staffMemberships = await prisma.tournamentStaff.findMany({
    where: {
      OR: [{ userId }, { email: { equals: userEmail, mode: 'insensitive' } }],
      status: 'ACCEPTED',
      tournamentId: test.tournamentId,
    },
    include: {
      events: {
        select: { eventId: true },
      },
    },
  })

  if (test.eventId) {
    return staffMemberships.some(staff => 
      staff.events.some(e => e.eventId === test.eventId)
    )
  }

  // For trial events, any ES staff member with access to tournament can grade
  return staffMemberships.length > 0
}

// PATCH /api/es/tests/[testId]/attempts/[attemptId]/grade
// Grade FRQ answers for an ES test attempt
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; attemptId: string }> | { testId: string; attemptId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const body = await req.json()
    const validatedData = gradeAttemptSchema.parse(body)

    // Check access
    const hasAccess = await hasESGradingAccess(session.user.id, session.user.email, resolvedParams.testId)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Not authorized to grade test attempts' },
        { status: 403 }
      )
    }

    // Get the attempt with all answers and questions
    const attempt = await prisma.eSTestAttempt.findUnique({
      where: { id: resolvedParams.attemptId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    })

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    if (attempt.testId !== resolvedParams.testId) {
      return NextResponse.json(
        { error: 'Attempt does not belong to this test' },
        { status: 400 }
      )
    }

    // Update grades in a transaction
    await prisma.$transaction(async (tx) => {
      for (const grade of validatedData.grades) {
        // Find the answer
        const answer = attempt.answers.find((a) => a.id === grade.answerId)
        if (!answer) {
          throw new Error(`Answer ${grade.answerId} not found in this attempt`)
        }

        // Validate points don't exceed question points
        const questionPoints = Number(answer.question.points)
        if (grade.pointsAwarded > questionPoints) {
          throw new Error(
            `Points awarded (${grade.pointsAwarded}) cannot exceed question points (${questionPoints})`
          )
        }

        // Update the answer
        await tx.eSTestAttemptAnswer.update({
          where: { id: grade.answerId },
          data: {
            pointsAwarded: new Decimal(grade.pointsAwarded),
            graderNote: grade.graderNote || null,
            gradedAt: new Date(),
          },
        })
      }

      // Recalculate total score
      const updatedAnswers = await tx.eSTestAttemptAnswer.findMany({
        where: { attemptId: resolvedParams.attemptId },
        include: { question: true },
      })

      // Calculate total earned points (only from graded questions)
      const totalEarned = updatedAnswers.reduce((sum, answer) => {
        if (answer.gradedAt !== null && answer.pointsAwarded !== null) {
          return sum + Number(answer.pointsAwarded)
        }
        return sum
      }, 0)

      // Check if all questions are graded
      const allGraded = updatedAnswers.every((answer) => answer.gradedAt !== null)

      // Update attempt with new score and status
      await tx.eSTestAttempt.update({
        where: { id: resolvedParams.attemptId },
        data: {
          gradeEarned: new Decimal(totalEarned),
          status: allGraded ? 'GRADED' : 'SUBMITTED',
        },
      })
    })

    // Fetch and return updated attempt
    const updatedAttempt = await prisma.eSTestAttempt.findUnique({
      where: { id: resolvedParams.attemptId },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      attempt: updatedAttempt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Grade ES attempt error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}


