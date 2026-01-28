import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership, isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const createPurchaseRequestSchema = z.object({
  clubId: z.string(),
  eventId: z.string().optional(),
  description: z.string().min(1).max(500),
  category: z.string().optional(),
  estimatedAmount: z.number().min(0),
  justification: z.string().optional(),
})

// GET /api/purchase-requests?clubId=xxx
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID is required' }, { status: 400 })
    }

    await requireMember(session.user.id, clubId)

    const purchaseRequests = await prisma.purchaseRequest.findMany({
      where: { clubId },
      orderBy: { createdAt: 'desc' },
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

    // Get requester user info for all purchase requests
    const requesterIds = [...new Set(purchaseRequests.map(req => req.requesterId))]
    const requesterMemberships = await prisma.membership.findMany({
      where: {
        id: { in: requesterIds },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    const requesterMap = new Map(requesterMemberships.map(m => [m.id, m.user]))

    // Attach requester user info to each purchase request
    const purchaseRequestsWithRequester = purchaseRequests.map(request => ({
      ...request,
      requester: requesterMap.get(request.requesterId) || null,
    }))

    return NextResponse.json({ purchaseRequests: purchaseRequestsWithRequester })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get purchase requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/purchase-requests
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createPurchaseRequestSchema.parse(body)

    // Get the user's membership
    const membership = await getUserMembership(session.user.id, validatedData.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // If eventId is provided, check budget limits
    // Members can only request against their own team's budget (or club-wide if no team budget exists)
    if (validatedData.eventId) {
      let budget = null
      
      // First, try to find a team-specific budget for the member's team
      if (membership.teamId) {
        budget = await prisma.eventBudget.findFirst({
          where: {
            clubId: validatedData.clubId,
            eventId: validatedData.eventId,
            teamId: membership.teamId,
          },
        })
      }
      
      // If no team-specific budget exists, check for club-wide budget
      if (!budget) {
        budget = await prisma.eventBudget.findFirst({
          where: {
            clubId: validatedData.clubId,
            eventId: validatedData.eventId,
            teamId: null,
          },
        })
      }

      // For non-admin members, ensure they can only request against budgets that apply to them
      const isAdminUser = await isAdmin(session.user.id, validatedData.clubId)
      if (!isAdminUser && !budget) {
        return NextResponse.json(
          {
            error: 'No budget available for this event. Please contact an admin to set up a budget for your team.',
            code: 'NO_BUDGET',
          },
          { status: 400 }
        )
      }

      // If a budget exists, validate the request
      if (budget) {
        // Calculate current spending
        // For team budgets, only count expenses/requests for that team
        // For club-wide budgets, count all expenses/requests
        const expenseWhere: any = {
          clubId: validatedData.clubId,
          eventId: validatedData.eventId,
        }
        
        if (budget.teamId) {
          // Team-specific budget: only count expenses for this team
          expenseWhere.teamId = budget.teamId
        } else {
          // Club-wide budget: count all expenses (teamId can be null or any value)
        }
        
        const expenses = await prisma.expense.findMany({
          where: expenseWhere,
          select: {
            amount: true,
          },
        })

        // Also count pending requests for the same scope
        const requestWhere: any = {
          clubId: validatedData.clubId,
          eventId: validatedData.eventId,
          status: 'PENDING',
        }
        if (budget.teamId) {
          requestWhere.teamId = budget.teamId
        }
        
        const pendingRequests = await prisma.purchaseRequest.findMany({
          where: requestWhere,
          select: {
            estimatedAmount: true,
          },
        })

        const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0)
        const totalRequested = pendingRequests.reduce((sum, req) => sum + req.estimatedAmount, 0)
        const remaining = budget.maxBudget - totalSpent

        // Check if request exceeds remaining budget
        if (validatedData.estimatedAmount > remaining) {
          if (!isAdminUser) {
            return NextResponse.json(
              {
                error: `Request exceeds remaining budget. Remaining: $${remaining.toFixed(2)}, Requested: $${validatedData.estimatedAmount.toFixed(2)}. Please contact an admin for approval.`,
                code: 'BUDGET_EXCEEDED',
                remaining,
                requested: validatedData.estimatedAmount,
              },
              { status: 400 }
            )
          }
          // Admin can proceed, but we'll note it needs override
        }
      } else {
        // No budget exists for this event - members can still request, but admins should set a budget
        // This is allowed, but we could optionally block it if desired
      }
    }

    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        clubId: validatedData.clubId,
        eventId: validatedData.eventId,
        teamId: membership.teamId, // Link to requester's team
        requesterId: membership.id,
        description: validatedData.description,
        category: validatedData.category,
        estimatedAmount: validatedData.estimatedAmount,
        justification: validatedData.justification,
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

    return NextResponse.json({ purchaseRequest }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Create purchase request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
