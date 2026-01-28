import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const updateExpenseSchema = z.object({
  eventId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  description: z.string().min(1).max(500).optional(),
  category: z.string().optional(),
  amount: z.number().min(0).optional(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
})

// PATCH /api/expenses/[expenseId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = updateExpenseSchema.parse(body)

    // Get the expense to check team
    const expense = await prisma.expense.findUnique({
      where: { id: resolvedParams.expenseId },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, expense.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can edit expenses' },
        { status: 403 }
      )
    }

    const updateData: any = {}
    if (validatedData.eventId !== undefined) updateData.eventId = validatedData.eventId
    if (validatedData.teamId !== undefined) updateData.teamId = validatedData.teamId
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.category !== undefined) updateData.category = validatedData.category
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount
    if (validatedData.date !== undefined) updateData.date = new Date(validatedData.date)
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes

    const updatedExpense = await prisma.expense.update({
      where: { id: resolvedParams.expenseId },
      data: updateData,
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        purchaseRequest: {
          select: {
            id: true,
            requesterId: true,
            description: true,
          },
        },
      },
    })

    return NextResponse.json({ expense: updatedExpense })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Update expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/expenses/[expenseId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the expense to check team
    const expense = await prisma.expense.findUnique({
      where: { id: resolvedParams.expenseId },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, expense.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can delete expenses' },
        { status: 403 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.delete({
        where: { id: resolvedParams.expenseId },
      })

      if (expense.purchaseRequestId) {
        await tx.purchaseRequest.delete({
          where: { id: expense.purchaseRequestId },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

