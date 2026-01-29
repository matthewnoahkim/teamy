import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin, getUserMembership } from '@/lib/rbac'

// POST /api/tests/[testId]/duplicate
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const originalTest = await prisma.test.findUnique({
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
        assignments: true,
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!originalTest) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, originalTest.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can duplicate tests' },
        { status: 403 }
      )
    }

    // Get membership for the new test
    const membership = await getUserMembership(session.user.id, originalTest.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Create duplicate test with all related data
    const duplicatedTest = await prisma.$transaction(async (tx) => {
      // Create the new test (reset to DRAFT, clear scheduling and password)
      const newTest = await tx.test.create({
        data: {
          clubId: originalTest.clubId,
          name: `${originalTest.name} (Copy)`,
          description: originalTest.description,
          instructions: originalTest.instructions,
          status: 'DRAFT',
          durationMinutes: originalTest.durationMinutes,
          maxAttempts: originalTest.maxAttempts,
          scoreReleaseMode: originalTest.scoreReleaseMode,
          randomizeQuestionOrder: originalTest.randomizeQuestionOrder,
          randomizeOptionOrder: originalTest.randomizeOptionOrder,
          requireFullscreen: originalTest.requireFullscreen,
          // Reset scheduling and password
          startAt: null,
          endAt: null,
          allowLateUntil: null,
          testPasswordHash: null,
          testPasswordPlaintext: null,
          releaseScoresAt: null,
          createdByMembershipId: membership.id,
        },
      })

      // Copy sections first (if they exist)
      const sectionIdMap = new Map<string, string>()
      if (originalTest.sections && originalTest.sections.length > 0) {
        for (const section of originalTest.sections) {
          const newSection = await tx.testSection.create({
            data: {
              testId: newTest.id,
              title: section.title,
              order: section.order,
            },
          })
          sectionIdMap.set(section.id, newSection.id)
        }
      }

      // Copy assignments
      if (originalTest.assignments.length > 0) {
        await tx.testAssignment.createMany({
          data: originalTest.assignments.map((assignment) => ({
            testId: newTest.id,
            assignedScope: assignment.assignedScope,
            teamId: assignment.teamId,
            targetMembershipId: assignment.targetMembershipId,
          })),
        })
      }

      // Copy questions and their options
      if (originalTest.questions.length > 0) {
        for (const question of originalTest.questions) {
          const newQuestion = await tx.question.create({
            data: {
              testId: newTest.id,
              sectionId: question.sectionId ? sectionIdMap.get(question.sectionId) || null : null,
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
            await tx.questionOption.createMany({
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
      await tx.testAudit.create({
        data: {
          testId: newTest.id,
          actorMembershipId: membership.id,
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
    console.error('Duplicate test error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    )
  }
}

