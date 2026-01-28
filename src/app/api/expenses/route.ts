import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const createExpenseSchema = z.object({
  clubId: z.string(),
  eventId: z.string().optional(),
  description: z.string().min(1).max(500),
  category: z.string().optional(),
  amount: z.number().min(0),
  date: z.string().datetime(),
  notes: z.string().optional(),
})

// GET /api/expenses?clubId=xxx
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

    const expenses = await prisma.expense.findMany({
      where: { clubId },
      orderBy: { date: 'desc' },
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

    // Get memberships for all addedById values (reviewers/admins who added expenses)
    const addedByIds = [...new Set(expenses.map((e) => e.addedById))]
    const addedByMemberships = await prisma.membership.findMany({
      where: {
        id: { in: addedByIds },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
          },
        },
      },
    })

    // Get memberships for all requesterIds (people who requested purchases)
    const requesterIds = expenses
      .map((e) => e.purchaseRequest?.requesterId)
      .filter((id): id is string => id !== undefined && id !== null)
    const requesterMemberships = await prisma.membership.findMany({
      where: {
        id: { in: requesterIds },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
          },
        },
      },
    })

    const addedByMap = new Map(addedByMemberships.map((m) => [m.id, m]))
    const requesterMap = new Map(requesterMemberships.map((m) => [m.id, m]))

    // Attach membership/team info to each expense
    // For expenses from purchase requests, use the requester's team
    // For direct expenses, use the addedBy's team
    const expensesWithPurchaser = expenses.map((expense) => {
      // If expense comes from a purchase request, use requester's team
      if (expense.purchaseRequest?.requesterId) {
        const requesterMembership = requesterMap.get(expense.purchaseRequest.requesterId)
        return {
          ...expense,
          addedBy: requesterMembership || null,
        }
      }
      // Otherwise, use the person who added the expense
      return {
        ...expense,
        addedBy: addedByMap.get(expense.addedById) || null,
      }
    })

    return NextResponse.json({ expenses: expensesWithPurchaser })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get expenses error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/expenses
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createExpenseSchema.parse(body)

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, validatedData.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can add expenses' },
        { status: 403 }
      )
    }

    // Get the user's membership ID
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: validatedData.clubId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const expense = await prisma.expense.create({
      data: {
        clubId: validatedData.clubId,
        eventId: validatedData.eventId,
        teamId: membership.teamId, // Link to admin's team (or null for club-wide)
        description: validatedData.description,
        category: validatedData.category,
        amount: validatedData.amount,
        date: new Date(validatedData.date),
        notes: validatedData.notes,
        addedById: membership.id,
      },
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

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Create expense error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
