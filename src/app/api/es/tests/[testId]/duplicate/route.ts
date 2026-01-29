import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import { hasESTestAccess } from '@/lib/rbac'

// POST /api/es/tests/[testId]/duplicate
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }



    // Get the original test with all related data
    const originalTest = await prisma.eSTest.findUnique({
      where: { id: resolvedParams.testId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })

    if (!originalTest) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check access - TDs have full access, ES only for their assigned events
    const hasAccess = await hasESTestAccess(session.user.id, session.user.email, resolvedParams.testId)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Only authorized users can duplicate tests' },
        { status: 403 }
      )
    }

    // Get the user's staff membership for this tournament
    const staffMembership = await prisma.tournamentStaff.findFirst({
      where: {
        tournamentId: originalTest.tournamentId,
        OR: [
          { userId: session.user.id },
          { email: { equals: session.user.email, mode: 'insensitive' } },
        ],
        status: 'ACCEPTED',
      },
    })

    if (!staffMembership) {
      return NextResponse.json(
        { error: 'Staff membership not found for this tournament' },
        { status: 403 }
      )
    }

    // Create duplicate test with all related data
    const duplicatedTest = await prisma.$transaction(async (tx) => {
      // Create the new test (always set to DRAFT, clear scheduling)
      const newTest = await tx.eSTest.create({
        data: {
          staffId: originalTest.staffId, // Keep same staff owner
          createdByStaffId: staffMembership.id, // Track who duplicated it
          tournamentId: originalTest.tournamentId,
          eventId: originalTest.eventId,
          name: `${originalTest.name} (Copy)`,
          description: originalTest.description,
          instructions: originalTest.instructions,
          content: originalTest.content,
          status: 'DRAFT', // Always draft
          durationMinutes: originalTest.durationMinutes,
          requireFullscreen: originalTest.requireFullscreen,
          allowCalculator: originalTest.allowCalculator,
          allowNoteSheet: originalTest.allowNoteSheet,
          calculatorType: originalTest.calculatorType,
          noteSheetInstructions: originalTest.noteSheetInstructions,
          autoApproveNoteSheet: originalTest.autoApproveNoteSheet,
          requireOneSitting: originalTest.requireOneSitting,
          maxAttempts: originalTest.maxAttempts,
          scoreReleaseMode: originalTest.scoreReleaseMode,
          // Reset scheduling
          startAt: null,
          endAt: null,
          allowLateUntil: null,
          releaseScoresAt: null,
          scoresReleased: false,
        },
      })

      // Copy questions and their options
      if (originalTest.questions.length > 0) {
        for (const question of originalTest.questions) {
          const newQuestion = await tx.eSTestQuestion.create({
            data: {
              testId: newTest.id,
              type: question.type,
              promptMd: question.promptMd,
              explanation: question.explanation,
              points: question.points,
              order: question.order,
              shuffleOptions: question.shuffleOptions,
              numericTolerance: question.numericTolerance,
            },
          })

          // Copy options if they exist
          if (question.options.length > 0) {
            await tx.eSTestQuestionOption.createMany({
              data: question.options.map((option) => ({
                questionId: newQuestion.id,
                label: option.label,
                isCorrect: option.isCorrect,
                order: option.order,
              })),
            })
          }
        }
      }

      // Create audit log
      await tx.eSTestAudit.create({
        data: {
          testId: newTest.id,
          actorStaffId: staffMembership.id,
          action: 'CREATE',
          details: {
            duplicatedFrom: originalTest.id,
            originalTestName: originalTest.name,
            questionCount: originalTest.questions.length,
          },
        },
      })

      return newTest
    })

    return NextResponse.json({ test: duplicatedTest })
  } catch (error) {
    console.error('Duplicate ES test error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    )
  }
}
