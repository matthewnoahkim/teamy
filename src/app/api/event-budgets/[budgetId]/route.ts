import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'

// DELETE /api/event-budgets/[budgetId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ budgetId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the budget to check team
    const budget = await prisma.eventBudget.findUnique({
      where: { id: resolvedParams.budgetId },
    })

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    // Only admins can delete budgets
    const isAdminUser = await isAdmin(session.user.id, budget.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can delete event budgets' },
        { status: 403 }
      )
    }

    await prisma.eventBudget.delete({
      where: { id: resolvedParams.budgetId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete event budget error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

