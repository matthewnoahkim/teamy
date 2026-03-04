import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createStoredFileDownloadResponse } from '@/lib/file-download'
import { prisma } from '@/lib/prisma'
import { requireMember } from '@/lib/rbac'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const resolvedParams = await params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: resolvedParams.attachmentId },
      select: {
        id: true,
        filePath: true,
        mimeType: true,
        originalFilename: true,
        announcement: {
          select: {
            clubId: true,
          },
        },
        calendarEvent: {
          select: {
            clubId: true,
          },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    const clubId = attachment.announcement?.clubId || attachment.calendarEvent?.clubId
    if (!clubId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    await requireMember(session.user.id, clubId)

    return createStoredFileDownloadResponse({
      storedPath: attachment.filePath,
      mimeType: attachment.mimeType,
      filename: attachment.originalFilename,
      inline: true,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.error('Attachment download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
