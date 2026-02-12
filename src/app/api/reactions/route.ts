import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const addReactionSchema = z.object({
  emoji: z.string().min(1).max(10), // Emoji character
  targetType: z.enum(['announcement', 'event', 'reply']),
  targetId: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { emoji, targetType, targetId } = addReactionSchema.parse(body)

    // Verify the target exists and user has access
    let hasAccess = false
    let clubId = ''

    if (targetType === 'announcement') {
      const announcement = await prisma.announcement.findUnique({
        where: { id: targetId },
        select: { id: true, clubId: true },
      })
      if (announcement) {
        hasAccess = true
        clubId = announcement.clubId
      }
    } else if (targetType === 'event') {
      const event = await prisma.calendarEvent.findUnique({
        where: { id: targetId },
        select: { id: true, clubId: true },
      })
      if (event) {
        hasAccess = true
        clubId = event.clubId
      }
    } else if (targetType === 'reply') {
      const reply = await prisma.announcementReply.findUnique({
        where: { id: targetId },
        include: {
          announcement: {
            select: { clubId: true },
          },
        },
      })
      if (reply) {
        hasAccess = true
        clubId = reply.announcement.clubId
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    // Verify user is a member of the team
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: clubId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 })
    }

    // Create or update reaction
    const reactionData: Record<string, unknown> = {
      emoji,
      userId: session.user.id,
    }

    if (targetType === 'announcement') {
      reactionData.announcementId = targetId
    } else if (targetType === 'event') {
      reactionData.eventId = targetId
    } else if (targetType === 'reply') {
      reactionData.replyId = targetId
    }

    const reaction = await prisma.reaction.upsert({
      where: {
        userId_announcementId_emoji: targetType === 'announcement' ? {
          userId: session.user.id,
          announcementId: targetId,
          emoji,
        } : undefined,
        userId_eventId_emoji: targetType === 'event' ? {
          userId: session.user.id,
          eventId: targetId,
          emoji,
        } : undefined,
        userId_replyId_emoji: targetType === 'reply' ? {
          userId: session.user.id,
          replyId: targetId,
          emoji,
        } : undefined,
      },
      update: {
        emoji,
      },
      create: reactionData as Prisma.ReactionCreateInput,
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

    return NextResponse.json({ reaction })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    console.error('Add reaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const targetType = searchParams.get('targetType')
    const targetId = searchParams.get('targetId')
    const emoji = searchParams.get('emoji')

    if (!targetType || !targetId || !emoji) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Build where clause based on target type
    const whereClause: Record<string, unknown> = {
      userId: session.user.id,
      emoji,
    }

    if (targetType === 'announcement') {
      whereClause.announcementId = targetId
    } else if (targetType === 'event') {
      whereClause.eventId = targetId
    } else if (targetType === 'reply') {
      whereClause.replyId = targetId
    } else {
      return NextResponse.json({ error: 'Invalid target type' }, { status: 400 })
    }

    // Delete the reaction
    await prisma.reaction.deleteMany({
      where: whereClause,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove reaction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
