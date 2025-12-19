import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Create a resource request
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, tag, url, category, scope, clubId } = body

    if (!name || !tag || !category || !clubId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, tag, category, clubId' },
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

    // If scope is CLUB, create resource directly
    if (scope === 'CLUB') {
      // Check if Resource model exists in Prisma client
      if (!prisma.resource) {
        console.error('Prisma Resource model not found. Please run: npx prisma generate')
        return NextResponse.json(
          { error: 'Resource model not available. Please regenerate Prisma client.' },
          { status: 500 }
        )
      }

      const resource = await prisma.resource.create({
        data: {
          name,
          tag,
          url: url || null,
          category,
          scope: 'CLUB',
          clubId,
        },
      })

      return NextResponse.json({ resource }, { status: 201 })
    }

    // If scope is PUBLIC, create a request
    // Check if ResourceRequest model exists in Prisma client
    if (!prisma.resourceRequest) {
      console.error('Prisma ResourceRequest model not found. Please run: npx prisma generate')
      return NextResponse.json(
        { error: 'ResourceRequest model not available. Please regenerate Prisma client.' },
        { status: 500 }
      )
    }

    const request = await prisma.resourceRequest.create({
      data: {
        name,
        tag,
        url: url || null,
        category,
        scope: 'PUBLIC',
        clubId,
        requestedById: membership.id,
      },
    })

    return NextResponse.json({ request }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating resource request:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create resource request' },
      { status: 500 }
    )
  }
}

// Get all resource requests (for dev panel)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (you may want to add a proper admin check)
    // For now, we'll allow any authenticated user to view requests
    // In production, you should add proper admin verification

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as 'PENDING' | 'APPROVED' | 'REJECTED' | null
    const search = searchParams.get('search')

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (search) {
      const searchLower = search.toLowerCase()
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { tag: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
      // For nested relations, we'll filter in memory or use a different approach
    }

    const requests = await prisma.resourceRequest.findMany({
      where,
      include: {
        club: {
          select: {
            id: true,
            name: true,
          },
        },
        requestedBy: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ requests })
  } catch (error: any) {
    console.error('Error fetching resource requests:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch resource requests' },
      { status: 500 }
    )
  }
}

