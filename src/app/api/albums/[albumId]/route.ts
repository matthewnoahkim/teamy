import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const updateAlbumSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
})

// PATCH - Update album
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { albumId } = await params
    const body = await req.json()
    const validated = updateAlbumSchema.parse(body)

    // Find the album
    const existingAlbum = await prisma.album.findUnique({
      where: { id: albumId },
    })

    if (!existingAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    }

    // Only the creator or admin can update
    const isAdminUser = await isAdmin(session.user.id, existingAlbum.clubId)
    if (existingAlbum.createdById !== session.user.id && !isAdminUser) {
      return NextResponse.json(
        { error: 'Only the creator or admin can update this album' },
        { status: 403 }
      )
    }

    const album = await prisma.album.update({
      where: { id: albumId },
      data: validated,
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
        error: 'Invalid data',
        details: error.issues
      }, { status: 400 })
    }
    console.error('Update album error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete album
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { albumId } = await params

    // Find the album
    const existingAlbum = await prisma.album.findUnique({
      where: { id: albumId },
    })

    if (!existingAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 })
    }

    // Only the creator or admin can delete
    const isAdminUser = await isAdmin(session.user.id, existingAlbum.clubId)
    if (existingAlbum.createdById !== session.user.id && !isAdminUser) {
      return NextResponse.json(
        { error: 'Only the creator or admin can delete this album' },
        { status: 403 }
      )
    }

    // Delete album (media items will be set to null albumId due to CASCADE)
    await prisma.album.delete({
      where: { id: albumId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete album error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

