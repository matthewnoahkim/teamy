import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serverSession } from '@/lib/server-session'

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const resolvedParams = await params

    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resolvedParams.clubId,
        },
      },
      select: {
        id: true,
        role: true,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403, headers: NO_STORE_HEADERS })
    }

    const club = await prisma.club.findUnique({
      where: { id: resolvedParams.clubId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    })

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json(
      {
        club: {
          id: club.id,
          name: club.name,
          memberCount: club._count.memberships,
        },
        currentMembership: {
          id: membership.id,
          role: membership.role,
        },
      },
      { headers: NO_STORE_HEADERS },
    )
  } catch (error) {
    console.error('Get club summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
