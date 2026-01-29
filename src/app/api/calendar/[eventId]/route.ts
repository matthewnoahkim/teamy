import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startUTC: z.string().optional(),
  endUTC: z.string().optional(),
  location: z.string().optional(),
  color: z.string().optional(),
  rsvpEnabled: z.boolean().optional(),
  important: z.boolean().optional(),
  scope: z.enum(['PERSONAL', 'TEAM', 'CLUB']).optional(),
  teamId: z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the event first to check permissions
    const event = await prisma.calendarEvent.findUnique({
      where: { id: resolvedParams.eventId },
      include: {
        creator: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const membership = await getUserMembership(session.user.id, event.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check permissions
    const isCreator = event.creatorId === membership.id
    const isAdminUser = await isAdmin(session.user.id, event.clubId)

    // Admins can edit all events EXCEPT personal events made by other members
    // Members can only edit their own events
    const canEdit = isCreator || (isAdminUser && event.scope !== 'PERSONAL')

    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this event' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validatedData = updateEventSchema.parse(body)

    // Build update data
    const updateData: any = {}
    if (validatedData.title !== undefined) updateData.title = validatedData.title
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.startUTC !== undefined) updateData.startUTC = new Date(validatedData.startUTC)
    if (validatedData.endUTC !== undefined) updateData.endUTC = new Date(validatedData.endUTC)
    if (validatedData.location !== undefined) updateData.location = validatedData.location
    if (validatedData.color !== undefined) updateData.color = validatedData.color
    if (validatedData.scope !== undefined) updateData.scope = validatedData.scope
    if (validatedData.teamId !== undefined) updateData.teamId = validatedData.teamId
    if (validatedData.important !== undefined) updateData.important = validatedData.important
    
    // For PERSONAL events, RSVP should always be disabled
    // For other events, use the provided value
    if (validatedData.scope === 'PERSONAL') {
      updateData.rsvpEnabled = false
    } else if (validatedData.rsvpEnabled !== undefined) {
      updateData.rsvpEnabled = validatedData.rsvpEnabled
    }

    const updatedEvent = await prisma.$transaction(async (tx) => {
      // Check if there's a linked announcement that needs to be deleted
      // This happens when changing from CLUB/TEAM to PERSONAL
      const existingEvent = await tx.calendarEvent.findUnique({
        where: { id: resolvedParams.eventId },
        include: { announcement: true },
      })

      const shouldDeleteAnnouncement = 
        existingEvent?.announcement && 
        validatedData.scope === 'PERSONAL' && 
        (existingEvent.scope === 'CLUB' || existingEvent.scope === 'TEAM')

      // If changing to PERSONAL scope, delete the linked announcement
      if (shouldDeleteAnnouncement && existingEvent?.announcement) {
        await tx.announcement.delete({
          where: { id: existingEvent.announcement.id },
        })
      }

      const updated = await tx.calendarEvent.update({
        where: { id: resolvedParams.eventId },
        data: updateData,
        include: {
          creator: {
            include: {
              user: true,
            },
          },
          team: true,
          rsvps: {
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
          announcement: true,
        },
      })

      // If event has a linked announcement (and wasn't deleted above), sync title and important field
      if (updated.announcement && !shouldDeleteAnnouncement) {
        const announcementUpdateData: any = {}
        if (validatedData.title) announcementUpdateData.title = validatedData.title
        if (validatedData.important !== undefined) announcementUpdateData.important = validatedData.important
        
        if (Object.keys(announcementUpdateData).length > 0) {
          await tx.announcement.update({
            where: { id: updated.announcement.id },
            data: announcementUpdateData,
          })
        }
      }

      return updated
    })

    return NextResponse.json({ event: updatedEvent })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Update calendar event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the event first to check permissions
    const event = await prisma.calendarEvent.findUnique({
      where: { id: resolvedParams.eventId },
      include: {
        creator: {
          include: {
            user: true,
          },
        },
        announcement: true,
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const membership = await getUserMembership(session.user.id, event.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check permissions
    const isCreator = event.creatorId === membership.id
    const isAdminUser = await isAdmin(session.user.id, event.clubId)

    // Admins can delete all events EXCEPT personal events made by other members
    // Members can only delete their own events
    const canDelete = isCreator || (isAdminUser && event.scope !== 'PERSONAL')

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this event' },
        { status: 403 }
      )
    }

    // Delete event and linked announcement in transaction
    await prisma.$transaction(async (tx) => {
      // If there's a linked announcement, delete it first
      if (event.announcement) {
        await tx.announcement.delete({
          where: { id: event.announcement.id },
        })
      }

      // Delete the calendar event
      await tx.calendarEvent.delete({
        where: { id: resolvedParams.eventId },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete calendar event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

