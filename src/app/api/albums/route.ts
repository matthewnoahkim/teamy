import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const createAlbumSchema = z.object({
  clubId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
})

// GET - Get all albums for a club
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    await requireMember(session.user.id, clubId)

    const albums = await prisma.album.findMany({
      where: { clubId },
      include: {
        _count: {
          select: {
            media: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ albums })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get albums error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new album (anyone can create)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = createAlbumSchema.parse(body)

    await requireMember(session.user.id, validated.clubId)

    const album = await prisma.album.create({
      data: {
        clubId: validated.clubId,
        name: validated.name,
        description: validated.description,
        createdById: session.user.id,
      },
      include: {
        _count: {
          select: {
            media: true,
          },
        },
      },
    })

    return NextResponse.json({ album })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid album data', 
        details: error.issues 
      }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Create album error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
