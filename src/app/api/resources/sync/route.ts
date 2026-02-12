import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Sync resources (delete all club-added resources)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { clubId } = body

    if (!clubId) {
      return NextResponse.json({ error: 'clubId is required' }, { status: 400 })
    }

    // Check if user is admin of the club
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId,
        },
      },
    })

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can sync resources' },
        { status: 403 }
      )
    }

    // Delete all resources associated with this club (both CLUB and PUBLIC scope)
    const deleteResult = await prisma.resource.deleteMany({
      where: {
        clubId,
      },
    })

    // Also delete any pending resource requests for this club
    await prisma.resourceRequest.deleteMany({
      where: {
        clubId,
      },
    })

    return NextResponse.json({ 
      success: true, 
      deletedCount: deleteResult.count 
    })
  } catch (error: unknown) {
    console.error('Error syncing resources:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync resources' },
      { status: 500 }
    )
  }
}

