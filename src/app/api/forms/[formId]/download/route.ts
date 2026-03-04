import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createStoredFileDownloadResponse } from '@/lib/file-download'
import { prisma } from '@/lib/prisma'
import { requireMember } from '@/lib/rbac'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const resolvedParams = await params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form = await prisma.form.findUnique({
      where: { id: resolvedParams.formId },
      select: {
        clubId: true,
        filePath: true,
        mimeType: true,
        originalFilename: true,
      },
    })

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    await requireMember(session.user.id, form.clubId)

    return createStoredFileDownloadResponse({
      storedPath: form.filePath,
      mimeType: form.mimeType,
      filename: form.originalFilename,
      inline: false,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.error('Form download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
