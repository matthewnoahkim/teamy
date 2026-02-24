import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership, isAdmin } from '@/lib/rbac'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { extensionForMime, resolveSafePublicUploadPath } from '@/lib/upload-security'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]

// POST - Upload attachment
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const announcementId = formData.get('announcementId') as string | null
    const calendarEventId = formData.get('calendarEventId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!announcementId && !calendarEventId) {
      return NextResponse.json(
        { error: 'Either announcementId or calendarEventId is required' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 100MB limit' },
        { status: 400 }
      )
    }

    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }

    // Get the announcement or calendar event to verify permissions
    let teamId: string | null = null
    let canEdit = false

    if (announcementId) {
      const announcement = await prisma.announcement.findUnique({
        where: { id: announcementId },
        include: {
          author: {
            include: {
              user: true,
            },
          },
        },
      })

      if (!announcement) {
        return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
      }

      teamId = announcement.clubId
      await requireMember(session.user.id, teamId)

      const membership = await getUserMembership(session.user.id, teamId)
      if (!membership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
      }

      // Check if user is author or admin
      const isAuthor = announcement.authorId === membership.id
      const isAdminUser = await isAdmin(session.user.id, teamId)
      canEdit = isAuthor || isAdminUser

      if (!canEdit) {
        return NextResponse.json(
          { error: 'Only the author or admin can add attachments' },
          { status: 403 }
        )
      }
    } else if (calendarEventId) {
      const calendarEvent = await prisma.calendarEvent.findUnique({
        where: { id: calendarEventId },
        include: {
          creator: {
            include: {
              user: true,
            },
          },
        },
      })

      if (!calendarEvent) {
        return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 })
      }

      teamId = calendarEvent.clubId
      await requireMember(session.user.id, teamId)

      const membership = await getUserMembership(session.user.id, teamId)
      if (!membership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
      }

      // Check if user is creator or admin
      const isCreator = calendarEvent.creatorId === membership.id
      const isAdminUser = await isAdmin(session.user.id, teamId)
      canEdit = isCreator || isAdminUser

      if (!canEdit) {
        return NextResponse.json(
          { error: 'Only the creator or admin can add attachments' },
          { status: 403 }
        )
      }
    }

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID not found' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = extensionForMime(file.type)
    const filename = `${timestamp}-${randomString}.${extension}`

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Save file
    const filePath = join(uploadsDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create attachment in database
    const attachment = await prisma.attachment.create({
      data: {
        filename,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        filePath: `/uploads/${filename}`,
        announcementId: announcementId || null,
        calendarEventId: calendarEventId || null,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({ attachment })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Attachment upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete attachment
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const attachmentId = searchParams.get('id')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 })
    }

    // Find the attachment
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        announcement: {
          include: {
            author: {
              include: {
                user: true,
              },
            },
          },
        },
        calendarEvent: {
          include: {
            creator: {
              include: {
                user: true,
              },
            },
          },
        },
        uploadedBy: true,
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Determine team ID and check permissions
    let teamId: string | null = null
    let canDelete = false

    if (attachment.announcementId && attachment.announcement) {
      teamId = attachment.announcement.clubId
      await requireMember(session.user.id, teamId)

      const membership = await getUserMembership(session.user.id, teamId)
      if (!membership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
      }

      // Check if user is uploader, announcement author, or admin
      const isUploader = attachment.uploadedById === session.user.id
      const isAuthor = attachment.announcement.authorId === membership.id
      const isAdminUser = await isAdmin(session.user.id, teamId)
      canDelete = isUploader || isAuthor || isAdminUser
    } else if (attachment.calendarEventId && attachment.calendarEvent) {
      teamId = attachment.calendarEvent.clubId
      await requireMember(session.user.id, teamId)

      const membership = await getUserMembership(session.user.id, teamId)
      if (!membership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
      }

      // Check if user is uploader, event creator, or admin
      const isUploader = attachment.uploadedById === session.user.id
      const isCreator = attachment.calendarEvent.creatorId === membership.id
      const isAdminUser = await isAdmin(session.user.id, teamId)
      canDelete = isUploader || isCreator || isAdminUser
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only the uploader, author/creator, or admin can delete this attachment' },
        { status: 403 }
      )
    }

    // Delete file from filesystem
    try {
      const safePath = resolveSafePublicUploadPath(attachment.filePath)
      if (safePath) {
        await unlink(safePath)
      } else {
        console.warn('Skipped deleting attachment with invalid path:', attachment.filePath)
      }
    } catch (err) {
      console.error('Failed to delete file:', err)
      // Continue even if file deletion fails
    }

    // Delete from database
    await prisma.attachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Delete attachment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

