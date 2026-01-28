import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createReplySchema = z.object({
  content: z.string().min(1).max(5000),
})

export async function POST(
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
    const { content } = createReplySchema.parse(body)

    // Get the announcement to verify it exists and get the team ID
    const announcement = await prisma.announcement.findUnique({
      where: { id: resolvedParams.announcementId },
      select: { id: true, clubId: true },
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    // Verify user is a member of the team
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: announcement.clubId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 })
    }

    // Create the reply
    const reply = await prisma.announcementReply.create({
      data: {
        announcementId: resolvedParams.announcementId,
        authorId: membership.id,
        content,
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
      },
    })

    return NextResponse.json({ reply })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    console.error('Create reply error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the announcement to verify access
    const announcement = await prisma.announcement.findUnique({
      where: { id: resolvedParams.announcementId },
      select: { id: true, clubId: true },
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    // Verify user is a member of the team
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: announcement.clubId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 })
    }

    // Fetch all replies
    const replies = await prisma.announcementReply.findMany({
      where: { announcementId: resolvedParams.announcementId },
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
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json({ replies })
  } catch (error) {
    console.error('Get replies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
