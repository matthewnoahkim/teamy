import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const gradeAnswerSchema = z.object({
  answerId: z.string(),
  pointsAwarded: z.number().min(0),
  graderNote: z.string().optional(),
})

const gradeAttemptSchema = z.object({
  grades: z.array(gradeAnswerSchema),
})

import { hasESTestAccess } from '@/lib/rbac'

// Helper to check if user has access to grade an ES test
async function hasESGradingAccess(userId: string, userEmail: string, testId: string): Promise<boolean> {
  return hasESTestAccess(userId, userEmail, testId)
}

// PATCH /api/es/tests/[testId]/attempts/[attemptId]/grade
// Grade FRQ answers for an ES test attempt
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; attemptId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


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
            pointsAwarded: new Prisma.Decimal(grade.pointsAwarded),
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
          gradeEarned: new Prisma.Decimal(totalEarned),
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
        { error: 'Invalid input', details: error.issues },
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




