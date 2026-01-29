import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin, getUserMembership } from '@/lib/rbac'
import { z } from 'zod'

const reviewPurchaseRequestSchema = z.object({
  status: z.enum(['APPROVED', 'DENIED']),
  reviewNote: z.string().optional(),
  // If approved, optionally add to expenses immediately
  addToExpenses: z.boolean().optional(),
  actualAmount: z.number().min(0).optional(), // Actual amount if different from estimated
  expenseDate: z.string().datetime().optional(), // Date of expense
  expenseNotes: z.string().optional(),
  adminOverride: z.boolean().optional(), // Allow admin to override budget limit
})

// PATCH /api/purchase-requests/[requestId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = reviewPurchaseRequestSchema.parse(body)

    // Get the purchase request
    const purchaseRequest = await prisma.purchaseRequest.findUnique({
      where: { id: resolvedParams.requestId },
    })

    if (!purchaseRequest) {
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, purchaseRequest.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can review purchase requests' },
        { status: 403 }
      )
    }

    // Get reviewer's membership
    const reviewerMembership = await getUserMembership(session.user.id, purchaseRequest.clubId)
    if (!reviewerMembership) {
      return NextResponse.json({ error: 'Reviewer membership not found' }, { status: 404 })
    }

    // If approving, check budget limits (unless admin override)
    if (validatedData.status === 'APPROVED' && purchaseRequest.eventId) {
      // Check for club-wide budget (teamId is null)
      const budget = await prisma.eventBudget.findFirst({
        where: {
          clubId: purchaseRequest.clubId,
          eventId: purchaseRequest.eventId,
          teamId: null,
        },
      })

      if (budget && !validatedData.adminOverride) {
        // Filter expenses by club if budget is team-specific
        const expenseWhere: any = {
          clubId: purchaseRequest.clubId,
          eventId: purchaseRequest.eventId,
        }
        if (budget.teamId) {
          expenseWhere.teamId = budget.teamId
        }
        
        const expenses = await prisma.expense.findMany({
          where: expenseWhere,
          select: {
            amount: true,
          },
        })

        const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0)
        const remaining = budget.maxBudget - totalSpent
        const requestAmount = validatedData.actualAmount ?? purchaseRequest.estimatedAmount

        if (requestAmount > remaining) {
          return NextResponse.json(
            {
              error: `Approval would exceed remaining budget. Remaining: $${remaining.toFixed(2)}, Requested: $${requestAmount.toFixed(2)}. Use admin override to proceed.`,
              code: 'BUDGET_EXCEEDED',
              remaining,
              requested: requestAmount,
            },
            { status: 400 }
          )
        }
      }
    }

    // Update the purchase request in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseRequest.update({
        where: { id: resolvedParams.requestId },
        data: {
          status: validatedData.status,
          reviewNote: validatedData.reviewNote,
          reviewedById: reviewerMembership.id,
          reviewedAt: new Date(),
          adminOverride: validatedData.adminOverride ?? false,
        },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          expense: {
            select: {
              id: true,
              amount: true,
              date: true,
            },
          },
        },
      })

      // If approved and addToExpenses is true, create an expense record
      let expense = null
      if (validatedData.status === 'APPROVED' && validatedData.addToExpenses) {
        expense = await tx.expense.create({
          data: {
            clubId: purchaseRequest.clubId,
            eventId: purchaseRequest.eventId,
            teamId: purchaseRequest.teamId, // Inherit team from purchase request
            description: purchaseRequest.description,
            category: purchaseRequest.category,
            amount: validatedData.actualAmount ?? purchaseRequest.estimatedAmount,
            date: validatedData.expenseDate ? new Date(validatedData.expenseDate) : new Date(),
            notes: validatedData.expenseNotes,
            purchaseRequestId: resolvedParams.requestId,
            addedById: reviewerMembership.id,
          },
        })

        // Update the purchase request status to COMPLETED
        await tx.purchaseRequest.update({
          where: { id: resolvedParams.requestId },
          data: { status: 'COMPLETED' },
        })
      }

      return { purchaseRequest: updated, expense }
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Review purchase request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/purchase-requests/[requestId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the purchase request
    const purchaseRequest = await prisma.purchaseRequest.findUnique({
      where: { id: resolvedParams.requestId },
    })

    if (!purchaseRequest) {
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 })
    }

    // Get user's membership
    const membership = await getUserMembership(session.user.id, purchaseRequest.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Only the requester or an admin can delete
    const isAdminUser = await isAdmin(session.user.id, purchaseRequest.clubId)
    const isRequester = purchaseRequest.requesterId === membership.id

    if (!isAdminUser && !isRequester) {
      return NextResponse.json(
        { error: 'Only the requester or an admin can delete this request' },
        { status: 403 }
      )
    }

    await prisma.purchaseRequest.delete({
      where: { id: resolvedParams.requestId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete purchase request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

