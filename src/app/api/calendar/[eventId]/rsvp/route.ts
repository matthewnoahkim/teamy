import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember } from '@/lib/rbac'
import { z } from 'zod'
import { RSVPStatus } from '@prisma/client'

const rsvpSchema = z.object({
  status: z.enum(['YES', 'NO']),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = rsvpSchema.parse(body)
    const { eventId } = resolvedParams

    // Get the event to check team membership
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { clubId: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify user is a member of the team
    await requireMember(session.user.id, event.clubId)

    // Upsert RSVP (create if doesn't exist, update if it does)
    const rsvp = await prisma.eventRSVP.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId: session.user.id,
        },
      },
      create: {
        eventId,
        userId: session.user.id,
        status: validated.status as RSVPStatus,
      },
      update: {
        status: validated.status as RSVPStatus,
      },
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
    })

    return NextResponse.json({ rsvp })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('RSVP error:', error)
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

    const { eventId } = resolvedParams

    // Get the event to check team membership
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { clubId: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Verify user is a member of the team
    await requireMember(session.user.id, event.clubId)

    // Delete the RSVP
    await prisma.eventRSVP.delete({
      where: {
        eventId_userId: {
          eventId,
          userId: session.user.id,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'RSVP not found' }, { status: 404 })
    }
    console.error('Delete RSVP error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

