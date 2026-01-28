import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership } from '@/lib/rbac'

// GET /api/tests/[testId]/user-attempts
// Get the current user's attempt count for a test
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const testId = resolvedParams.testId

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        id: true,
        clubId: true,
        maxAttempts: true,
      },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    const membership = await getUserMembership(session.user.id, test.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    // Count completed attempts (SUBMITTED or GRADED)
    const attemptsUsed = await prisma.testAttempt.count({
      where: {
        membershipId: membership.id,
        testId: testId,
        status: {
          in: ['SUBMITTED', 'GRADED'],
        },
      },
    })

    return NextResponse.json({
      attemptsUsed,
      maxAttempts: test.maxAttempts,
      hasReachedLimit: test.maxAttempts !== null && attemptsUsed >= test.maxAttempts,
    })
  } catch (error) {
    console.error('Get user attempts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

