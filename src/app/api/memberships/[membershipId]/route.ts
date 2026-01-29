import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const updateMembershipSchema = z.object({
  teamId: z.string().nullable().optional(),
  roles: z
    .array(z.enum(['COACH', 'CAPTAIN', 'MEMBER']))
    .optional()
    .transform((roles) => roles ?? undefined),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await prisma.membership.findUnique({
      where: { id: resolvedParams.membershipId },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    await requireAdmin(session.user.id, membership.clubId)

    const body = await req.json()
    const { teamId, roles, role } = updateMembershipSchema.parse(body)

    // If teamId is provided, verify it belongs to the same club and check size limit
    if (teamId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
      })

      if (!team || team.clubId !== membership.clubId) {
        return NextResponse.json({ error: 'Invalid team' }, { status: 400 })
      }

      // Check team size cap (15 members per team)
      const teamMemberCount = await prisma.membership.count({
        where: { teamId },
      })

      if (teamMemberCount >= 15) {
        return NextResponse.json(
          { error: 'Team is full (maximum 15 members per team)' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, any> = {}
    if (teamId !== undefined) {
      updateData.teamId = teamId
    }
    if (roles !== undefined) {
      updateData.roles = roles
    }
    if (role !== undefined && role !== membership.role) {
      if (role === 'MEMBER' && membership.role === 'ADMIN') {
        const adminCount = await prisma.membership.count({
          where: {
            clubId: membership.clubId,
            role: 'ADMIN',
          },
        })

        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot remove the only admin. Please promote another member first.' },
            { status: 400 }
          )
        }
      }

      updateData.role = role
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const updated = await prisma.membership.update({
      where: { id: resolvedParams.membershipId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: true,
      },
    })

    return NextResponse.json({ membership: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Update membership error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await prisma.membership.findUnique({
      where: { id: resolvedParams.membershipId },
      include: {
        club: {
          include: {
            memberships: {
              where: {
                role: 'ADMIN',
              },
            },
          },
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check if the requester is an admin of the club
    const requesterMembership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: membership.clubId,
        },
      },
    })

    if (!requesterMembership) {
      return NextResponse.json({ error: 'You are not a member of this club' }, { status: 403 })
    }

    const isRequesterAdmin = requesterMembership.role === 'ADMIN'
    const isSelfRemoval = membership.userId === session.user.id

    // Only admins can remove others, or users can remove themselves
    if (!isRequesterAdmin && !isSelfRemoval) {
      return NextResponse.json({ error: 'Only admins can remove other members' }, { status: 403 })
    }

    // Check if this is the last admin
    if (
      membership.role === 'ADMIN' &&
      membership.club.memberships.length === 1 &&
      !isSelfRemoval
    ) {
      return NextResponse.json(
        { error: 'Cannot remove the only admin. Please promote another member to admin first or delete the club.' },
        { status: 400 }
      )
    }

    // Delete the membership (cascade will handle related records)
    await prisma.membership.delete({
      where: { id: resolvedParams.membershipId },
    })

    // Revalidate dashboard to refresh the memberships list
    revalidatePath('/dashboard/club')
    revalidatePath('/dashboard')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete membership error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
