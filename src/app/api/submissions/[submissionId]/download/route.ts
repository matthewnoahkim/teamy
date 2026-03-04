import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createStoredFileDownloadResponse } from '@/lib/file-download'
import { prisma } from '@/lib/prisma'
import { isAdmin, requireMember } from '@/lib/rbac'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const resolvedParams = await params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const submission = await prisma.formSubmission.findUnique({
      where: { id: resolvedParams.submissionId },
      select: {
        userId: true,
        filePath: true,
        mimeType: true,
        originalFilename: true,
        form: {
          select: {
            clubId: true,
          },
        },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    await requireMember(session.user.id, submission.form.clubId)

    const admin = await isAdmin(session.user.id, submission.form.clubId)
    const isOwner = submission.userId === session.user.id
    if (!admin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return createStoredFileDownloadResponse({
      storedPath: submission.filePath,
      mimeType: submission.mimeType,
      filename: submission.originalFilename,
      inline: false,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.error('Submission download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
