import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember } from '@/lib/rbac'

// GET - Get all media items for a club or album
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')
    const albumId = searchParams.get('albumId')
    const mediaType = searchParams.get('mediaType') as 'IMAGE' | 'VIDEO' | null

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    await requireMember(session.user.id, clubId)

    const whereClause: Record<string, unknown> = { clubId }

    if (albumId) {
      whereClause.albumId = albumId
    }

    if (mediaType) {
      whereClause.mediaType = mediaType
    }

    const mediaItems = await prisma.mediaItem.findMany({
      where: whereClause,
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        album: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ mediaItems })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get media error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
