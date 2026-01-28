import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  important: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = updateAnnouncementSchema.parse(body)

    // Get the announcement first to check permissions
    const announcement = await prisma.announcement.findUnique({
      where: { id: resolvedParams.announcementId },
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

    const membership = await getUserMembership(session.user.id, announcement.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check permissions: must be an admin (admins can edit all announcements)
    const isAdminUser = await isAdmin(session.user.id, announcement.clubId)

    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only team admins can edit announcements' },
        { status: 403 }
      )
    }

    // Update announcement and linked calendar event if exists
    const updatedAnnouncement = await prisma.$transaction(async (tx) => {
      const updated = await tx.announcement.update({
        where: { id: resolvedParams.announcementId },
        data: {
          ...(validated.title && { title: validated.title }),
          ...(validated.content && { content: validated.content }),
          ...(validated.important !== undefined && { important: validated.important }),
        },
        include: {
          author: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          visibilities: {
            include: {
              team: true,
            },
          },
          calendarEvent: true,
        },
      })

      // If announcement is linked to a calendar event, sync title and important field
      if (updated.calendarEventId) {
        const updateData: any = {}
        if (validated.title) updateData.title = validated.title
        if (validated.important !== undefined) updateData.important = validated.important
        
        if (Object.keys(updateData).length > 0) {
          await tx.calendarEvent.update({
            where: { id: updated.calendarEventId },
            data: updateData,
          })
        }
      }

      return updated
    })

    return NextResponse.json({ announcement: updatedAnnouncement })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Update announcement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the announcement first to check permissions
    const announcement = await prisma.announcement.findUnique({
      where: { id: resolvedParams.announcementId },
      include: {
        author: {
          include: {
            user: true,
          },
        },
        calendarEvent: true,
      },
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    const membership = await getUserMembership(session.user.id, announcement.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check permissions: must be author or admin
    const isAuthor = announcement.authorId === membership.id
    const isAdminUser = await isAdmin(session.user.id, announcement.clubId)

    if (!isAuthor && !isAdminUser) {
      return NextResponse.json(
        { error: 'Only the author or team admin can delete this announcement' },
        { status: 403 }
      )
    }

    // Delete announcement only (keep calendar event and attendance if they exist)
    // The calendar event remains in the calendar and attendance tabs
    await prisma.announcement.delete({
      where: { id: resolvedParams.announcementId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete announcement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

