import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin, getUserMembership } from '@/lib/rbac'
import { z } from 'zod'

const assignSchema = z.object({
  assignments: z.array(z.object({
    assignedScope: z.enum(['CLUB', 'TEAM', 'PERSONAL']),
    teamId: z.string().optional(),
    targetMembershipId: z.string().optional(),
    eventId: z.string().optional(), // For event-based assignments
  })),
})

// POST /api/tests/[testId]/assign
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

    const { testId } = resolvedParams
    const body = await req.json()
    const validatedData = assignSchema.parse(body)

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
        { error: 'Only admins can assign tests' },
        { status: 403 }
      )
    }

    // Delete existing assignments and create new ones
    await prisma.$transaction(async (tx) => {
      // Delete old assignments
      await tx.testAssignment.deleteMany({
        where: { testId },
      })

      // Create new assignments
      await tx.testAssignment.createMany({
        data: validatedData.assignments.map((a) => ({
          testId,
          assignedScope: a.assignedScope,
          teamId: a.teamId,
          targetMembershipId: a.targetMembershipId,
          eventId: a.eventId,
        })),
      })
    })

    // Fetch updated assignments
    const assignments = await prisma.testAssignment.findMany({
      where: { testId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ assignments })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Assign test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
