import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'
import { validateRosterAssignment } from '@/lib/conflicts'
import { z } from 'zod'

const createAssignmentSchema = z.object({
  teamId: z.string(),
  membershipId: z.string(),
  eventId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = createAssignmentSchema.parse(body)

    // Get team to verify club access
    const team = await prisma.team.findUnique({
      where: { id: validated.teamId },
      include: { club: true },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    await requireAdmin(session.user.id, team.clubId)

    // Validate the assignment
    const validation = await validateRosterAssignment(
      validated.membershipId,
      validated.teamId,
      validated.eventId
    )

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, code: validation.code },
        { status: 400 }
      )
    }

    // Create assignment
    const assignment = await prisma.rosterAssignment.create({
      data: {
        teamId: validated.teamId,
        membershipId: validated.membershipId,
        eventId: validated.eventId,
      },
      include: {
        membership: {
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
        },
        event: true,
        team: true,
      },
    })

    return NextResponse.json({ assignment })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Create roster assignment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
