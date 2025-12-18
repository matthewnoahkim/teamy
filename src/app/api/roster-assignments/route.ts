import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch roster assignments for a user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clubId = searchParams.get('clubId')
    const membershipId = searchParams.get('membershipId')

    if (!clubId) {
      return NextResponse.json({ error: 'Missing clubId' }, { status: 400 })
    }

    // If membershipId is provided, fetch for that specific membership
    // Otherwise, fetch for the current user's membership in the club
    let targetMembershipId = membershipId

    if (!targetMembershipId) {
      const membership = await prisma.membership.findFirst({
        where: {
          clubId,
          userId: session.user.id,
        },
      })

      if (!membership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
      }

      targetMembershipId = membership.id
    } else {
      // Verify the user has access to view this membership's assignments
      // Either it's their own membership, or they're an admin
      const userMembership = await prisma.membership.findFirst({
        where: {
          clubId,
          userId: session.user.id,
        },
      })

      if (!userMembership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
      }

      if (userMembership.id !== targetMembershipId && userMembership.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const assignments = await prisma.rosterAssignment.findMany({
      where: {
        membershipId: targetMembershipId,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            division: true,
          },
        },
      },
      orderBy: {
        event: {
          name: 'asc',
        },
      },
    })

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Failed to fetch roster assignments:', error)
    return NextResponse.json({ error: 'Failed to fetch roster assignments' }, { status: 500 })
  }
}

