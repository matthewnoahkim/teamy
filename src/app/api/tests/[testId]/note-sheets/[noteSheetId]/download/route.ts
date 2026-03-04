import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createStoredFileDownloadResponse } from '@/lib/file-download'
import { prisma } from '@/lib/prisma'
import { hasESTestAccess, isAdmin, requireMember } from '@/lib/rbac'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string; noteSheetId: string }> }
) {
  const resolvedParams = await params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const noteSheet = await prisma.noteSheet.findUnique({
      where: { id: resolvedParams.noteSheetId },
      select: {
        id: true,
        filePath: true,
        mimeType: true,
        filename: true,
        testId: true,
        esTestId: true,
        membership: {
          select: {
            userId: true,
          },
        },
        test: {
          select: {
            clubId: true,
          },
        },
      },
    })

    if (!noteSheet) {
      return NextResponse.json({ error: 'Note sheet not found' }, { status: 404 })
    }

    const isOwner = noteSheet.membership.userId === session.user.id
    let allowed = false

    if (noteSheet.testId) {
      if (noteSheet.testId !== resolvedParams.testId || !noteSheet.test) {
        return NextResponse.json({ error: 'Note sheet not found' }, { status: 404 })
      }

      await requireMember(session.user.id, noteSheet.test.clubId)
      const admin = await isAdmin(session.user.id, noteSheet.test.clubId)
      allowed = isOwner || admin
    } else if (noteSheet.esTestId) {
      if (noteSheet.esTestId !== resolvedParams.testId) {
        return NextResponse.json({ error: 'Note sheet not found' }, { status: 404 })
      }

      if (isOwner) {
        allowed = true
      } else {
        const userEmail = session.user.email || ''
        allowed = await hasESTestAccess(session.user.id, userEmail, resolvedParams.testId)
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!noteSheet.filePath) {
      return NextResponse.json({ error: 'This note sheet does not include an uploaded file' }, { status: 404 })
    }

    return createStoredFileDownloadResponse({
      storedPath: noteSheet.filePath,
      mimeType: noteSheet.mimeType,
      filename: noteSheet.filename || 'note-sheet.pdf',
      inline: true,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.error('Note sheet download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
