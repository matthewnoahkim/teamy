import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'

const updateMediaSchema = z.object({
  caption: z.string().optional(),
  albumId: z.string().nullable().optional(),
})

// PATCH - Update media item
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const mediaId = resolvedParams.mediaId
    const body = await req.json()
    const validated = updateMediaSchema.parse(body)

    // Find the media item
    const existingMedia = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
    })

    if (!existingMedia) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Only the uploader or admin can update
    const isAdminUser = await isAdmin(session.user.id, existingMedia.clubId)
    if (existingMedia.uploadedById !== session.user.id && !isAdminUser) {
      return NextResponse.json(
        { error: 'Only the uploader or admin can update this media' },
        { status: 403 }
      )
    }

    const mediaItem = await prisma.mediaItem.update({
      where: { id: mediaId },
      data: validated,
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
    })

    return NextResponse.json({ mediaItem })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid data', 
        details: error.issues 
      }, { status: 400 })
    }
    console.error('Update media error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete media item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const mediaId = resolvedParams.mediaId

    // Find the media item
    const existingMedia = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
    })

    if (!existingMedia) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    // Only the uploader or admin can delete
    const isAdminUser = await isAdmin(session.user.id, existingMedia.clubId)
    if (existingMedia.uploadedById !== session.user.id && !isAdminUser) {
      return NextResponse.json(
        { error: 'Only the uploader or admin can delete this media' },
        { status: 403 }
      )
    }

    // Delete file from filesystem
    try {
      const filePath = join(process.cwd(), 'public', existingMedia.filePath)
      await unlink(filePath)
    } catch (err) {
      console.error('Failed to delete file:', err)
      // Continue even if file deletion fails
    }

    // Delete from database
    await prisma.mediaItem.delete({
      where: { id: mediaId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete media error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

