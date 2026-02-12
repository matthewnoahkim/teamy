import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Get resources for a club
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')
    const category = searchParams.get('category')

    if (!clubId) {
      return NextResponse.json(
        { error: 'clubId is required' },
        { status: 400 }
      )
    }

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this club' }, { status: 403 })
    }

    // Check if resource model exists
    if (!prisma.resource) {
      // Return empty array if model doesn't exist yet
      return NextResponse.json({ resources: [] })
    }

    // Get club resources and public resources
    const where: Record<string, unknown> = {
      OR: [
        { scope: 'PUBLIC' },
        { scope: 'CLUB', clubId },
      ],
    }

    if (category) {
      where.category = category
    }

    const resources = await prisma.resource.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ resources })
  } catch (error: unknown) {
    console.error('Error fetching resources:', error)
    // If the error is about the model not existing, return empty array
    const errMessage = error instanceof Error ? error.message : undefined
    const errCode = (error as Record<string, unknown>)?.code
    if (errMessage?.includes('resource') || errCode === 'P2021') {
      return NextResponse.json({ resources: [] })
    }
    return NextResponse.json(
      { error: errMessage || 'Failed to fetch resources' },
      { status: 500 }
    )
  }
}
