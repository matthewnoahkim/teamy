import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { z } from 'zod'
import { AiSuggestionStatus, Prisma } from '@prisma/client'

const gradeAnswerSchema = z.object({
  answerId: z.string(),
  pointsAwarded: z.number().min(0).nullable(), // null means ungrade
  graderNote: z.string().optional(),
  aiSuggestionId: z.string().optional().nullable(),
})

const gradeAttemptSchema = z.object({
  grades: z.array(gradeAnswerSchema),
})

// PATCH /api/tests/[testId]/attempts/[attemptId]/grade
// Grade FRQ answers for an attempt (admin only)
export async function PATCH(
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
    const validatedData = gradeAttemptSchema.parse(body)

    // Get the test and verify admin access
    const test = await prisma.test.findUnique({
      where: { id: resolvedParams.testId },
      select: { clubId: true },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    const isAdminUser = await isAdmin(session.user.id, test.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can grade test attempts' },
        { status: 403 }
      )
    }

    const adminMembership = await getUserMembership(session.user.id, test.clubId)
    if (!adminMembership) {
      return NextResponse.json({ error: 'Membership not found for admin user' }, { status: 403 })
    }

    // Get the attempt with all answers and questions
    const attempt = await prisma.testAttempt.findUnique({
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

        // If pointsAwarded is null, this means "ungrade" - clear the grade
        if (grade.pointsAwarded === null) {
          await tx.attemptAnswer.update({
            where: { id: grade.answerId },
            data: {
              pointsAwarded: null,
              graderNote: null,
              gradedAt: null, // Clear gradedAt to mark as ungraded
            },
          })
        } else {
          // Validate points don't exceed question points
          const questionPoints = Number(answer.question.points)
          if (grade.pointsAwarded > questionPoints) {
            throw new Error(
              `Points awarded (${grade.pointsAwarded}) cannot exceed question points (${questionPoints})`
            )
          }

          // Update the answer with a grade
          // pointsAwarded of 0 is still a valid grade (explicitly graded as 0)
          await tx.attemptAnswer.update({
            where: { id: grade.answerId },
            data: {
              pointsAwarded: new Prisma.Decimal(grade.pointsAwarded),
              graderNote: grade.graderNote || null,
              gradedAt: new Date(), // Set gradedAt when saving a grade
            },
          })

          if (grade.aiSuggestionId) {
            const suggestion = await tx.aiGradingSuggestion.findUnique({
              where: { id: grade.aiSuggestionId },
            })

            if (!suggestion) {
              throw new Error('AI suggestion reference not found')
            }

            if (suggestion.answerId !== grade.answerId || suggestion.attemptId !== resolvedParams.attemptId) {
              throw new Error('AI suggestion does not match this answer')
            }

            const suggestedPoints = Number(suggestion.suggestedPoints)
            const acceptedStatus =
              Math.abs(grade.pointsAwarded - suggestedPoints) < 0.01
                ? AiSuggestionStatus.ACCEPTED
                : AiSuggestionStatus.OVERRIDDEN

            await tx.aiGradingSuggestion.update({
              where: { id: suggestion.id },
              data: {
                status: acceptedStatus,
                acceptedPoints: new Prisma.Decimal(grade.pointsAwarded),
                acceptedAt: new Date(),
                acceptedByUserId: session.user.id,
                acceptedByMembershipId: adminMembership.id,
              },
            })
          }
        }
      }

      // Recalculate total score
      const updatedAnswers = await tx.attemptAnswer.findMany({
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
      // For free response questions (LONG_TEXT, SHORT_TEXT), check if they have gradedAt set
      // For multipart FRQs, check if ALL parts are graded
      // For auto-graded questions (MCQ, NUMERIC, etc.), they're considered graded if answered
      const allGraded = updatedAnswers.every((answer) => {
        const isFreeResponse = answer.question.type === 'LONG_TEXT' || answer.question.type === 'SHORT_TEXT'
        if (isFreeResponse) {
          // Free response questions must have gradedAt to be considered graded
          if (answer.gradedAt === null) {
            return false
          }
          
          // Check if this is a multipart FRQ by checking promptMd
          const promptMd = answer.question.promptMd || ''
          const isMultipart = promptMd.includes('---FRQ_PARTS---')
          
          if (isMultipart && answer.graderNote) {
            // Parse partPoints from graderNote to check if all parts are graded
            try {
              const parsed = JSON.parse(answer.graderNote)
              if (parsed && typeof parsed === 'object' && Array.isArray(parsed.partPoints)) {
                const partPoints = parsed.partPoints
                
                // Extract expected number of parts from promptMd
                const partsText = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)?.[1]
                if (partsText) {
                  const partRegex = /\[PART:([a-z]):(\d+(?:\.\d+)?)\]\n([\s\S]*?)(?=\n\n\[PART:|$)/g
                  const expectedParts: any[] = []
                  let match
                  while ((match = partRegex.exec(partsText)) !== null) {
                    expectedParts.push(match[1])
                  }
                  
                  // Check if all expected parts are graded (all are not null)
                  if (expectedParts.length > 0) {
                    const allPartsGraded = expectedParts.every((_, index) => {
                      return partPoints[index] !== null && partPoints[index] !== undefined
                    })
                    return allPartsGraded
                  }
                }
              }
            } catch {
              // If parsing fails, treat as plain text feedback (single-part)
            }
          }
          
          // For single-part FRQs, just check if gradedAt is set
          return true
        } else {
          // Auto-graded questions are considered graded if they have an answer
          return answer.gradedAt !== null || (
            answer.selectedOptionIds !== null || 
            answer.numericAnswer !== null ||
            answer.answerText !== null
          )
        }
      })

      // Update attempt with new score and status
      // SUBMITTED means partially graded or not graded
      // GRADED means all questions are graded
      await tx.testAttempt.update({
        where: { id: resolvedParams.attemptId },
        data: {
          gradeEarned: new Prisma.Decimal(totalEarned),
          status: allGraded ? 'GRADED' : 'SUBMITTED',
        },
      })
    })

    // Fetch and return updated attempt
    const updatedAttempt = await prisma.testAttempt.findUnique({
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
    console.error('Grade attempt error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
