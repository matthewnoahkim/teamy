import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'
import { verifyTestPassword } from '@/lib/test-security'
import { z } from 'zod'

const updateQuestionSchema = z.object({
  type: z.enum(['MCQ_SINGLE', 'MCQ_MULTI', 'SHORT_TEXT', 'LONG_TEXT', 'NUMERIC']).optional(),
  promptMd: z.string().min(1).optional(),
  explanation: z.string().optional().nullable(),
  points: z.number().min(0).optional(),
  order: z.number().int().min(0).optional(),
  sectionId: z.string().optional().nullable(),
  shuffleOptions: z.boolean().optional(),
  numericTolerance: z.number().min(0).optional().nullable(),
  options: z.array(z.object({
    id: z.string().optional(),
    label: z.string().min(1),
    isCorrect: z.boolean(),
    order: z.number().int().min(0),
  })).optional(),
})

// PATCH /api/tests/[testId]/questions/[questionId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { testId, questionId } = resolvedParams
    const body = await req.json()
    const validatedData = updateQuestionSchema.parse(body)

    const test = await prisma.test.findUnique({
      where: { id: testId },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, test.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can edit questions' },
        { status: 403 }
      )
    }


    // Update question with options in a transaction
    const question = await prisma.$transaction(async (tx) => {
      // Update question fields
      const updateData: any = {}
      if (validatedData.type !== undefined) updateData.type = validatedData.type
      if (validatedData.promptMd !== undefined) updateData.promptMd = validatedData.promptMd
      if (validatedData.explanation !== undefined) updateData.explanation = validatedData.explanation
      if (validatedData.points !== undefined) updateData.points = validatedData.points
      if (validatedData.order !== undefined) updateData.order = validatedData.order
      if (validatedData.sectionId !== undefined) updateData.sectionId = validatedData.sectionId
      if (validatedData.shuffleOptions !== undefined) updateData.shuffleOptions = validatedData.shuffleOptions
      if (validatedData.numericTolerance !== undefined) updateData.numericTolerance = validatedData.numericTolerance

      const updatedQuestion = await tx.question.update({
        where: { id: questionId },
        data: updateData,
      })

      // Update options if provided
      if (validatedData.options !== undefined) {
        // Delete all existing options
        await tx.questionOption.deleteMany({
          where: { questionId },
        })

        // Create new options
        if (validatedData.options.length > 0) {
          await tx.questionOption.createMany({
            data: validatedData.options.map((opt) => ({
              questionId,
              label: opt.label,
              isCorrect: opt.isCorrect,
              order: opt.order,
            })),
          })
        }
      }

      // Return question with options
      return tx.question.findUnique({
        where: { id: questionId },
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
      })
    })

    return NextResponse.json({ question })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Update question error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tests/[testId]/questions/[questionId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { testId, questionId } = resolvedParams
    const test = await prisma.test.findUnique({
      where: { id: testId },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, test.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can delete questions' },
        { status: 403 }
      )
    }


    // Delete question (options will be cascade deleted)
    await prisma.question.delete({
      where: { id: questionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete question error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
