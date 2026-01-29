import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership } from '@/lib/rbac'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ announcementId: string; replyId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { announcementId, replyId } = resolvedParams

    // Verify announcement exists and get its clubId
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { clubId: true },
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    // Ensure user is a member of the team
    await requireMember(session.user.id, announcement.clubId)

    // Get the reply to verify ownership
    const reply = await prisma.announcementReply.findUnique({
      where: { id: replyId },
      include: {
        author: {
          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    })

    if (!reply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 })
    }

    // Check if user is the author of the reply
    if (reply.author.user.id !== session.user.id) {
      return NextResponse.json({ error: 'You can only delete your own replies' }, { status: 403 })
    }

    // Delete the reply
    await prisma.announcementReply.delete({
      where: { id: replyId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Delete reply error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
