import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  sanitizeSearchQuery,
  validateEnum,
} from '@/lib/input-validation'

// Create a resource request (also creates club-visible resource immediately)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, tag, url, category, clubId } = body

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

    // Check if resource model exists (handles case where Prisma client needs regeneration)
    if (!prisma.resource) {
      return NextResponse.json(
        { error: 'Database not fully configured. Please contact administrator to run: npx prisma generate' },
        { status: 503 }
      )
    }

    // Create the resource with CLUB scope (visible to submitting club immediately)
    let resource
    try {
      resource = await prisma.resource.create({
        data: {
          name,
          tag,
          url: url || null,
          category,
          scope: 'CLUB',
          clubId,
        },
      })
    } catch (resourceError: any) {
      console.error('Error creating resource:', resourceError)
      return NextResponse.json(
        { error: 'Failed to create resource. Database may need migration.' },
        { status: 500 }
      )
    }

    // Create the request for admin review
    let request
    try {
      request = await prisma.resourceRequest.create({
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
    } catch (requestError: any) {
      console.error('Error creating resource request:', requestError)
      // Resource was created but request failed - still return success
      return NextResponse.json({ 
        resource,
        request: null,
        warning: 'Resource created but approval request failed'
      }, { status: 201 })
    }

    return NextResponse.json({ 
      resource, 
      request 
    }, { status: 201 })
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

    // Check if resourceRequest model exists
    if (!prisma.resourceRequest) {
      return NextResponse.json({ requests: [] })
    }

    const { searchParams } = new URL(req.url)
    
    // Validate and sanitize inputs
    const status = validateEnum(searchParams.get('status'), ['PENDING', 'APPROVED', 'REJECTED'] as const)
    const search = sanitizeSearchQuery(searchParams.get('search'), 200)

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (search) {
      // All search values are sanitized
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { tag: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
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
