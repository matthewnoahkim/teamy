import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, isAdmin, getUserMembership } from '@/lib/rbac'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { extensionForMime } from '@/lib/upload-security'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]

// GET - Get all forms for a club
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    await requireMember(session.user.id, clubId)

    const _membership = await getUserMembership(session.user.id, clubId)

    const forms = await prisma.form.findMany({
      where: { clubId },
      include: {
        submissions: {
          where: { userId: session.user.id },
          select: {
            id: true,
            status: true,
            submittedAt: true,
            filePath: true,
            originalFilename: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ forms })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get forms error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Upload a new form (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const clubId = formData.get('clubId') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string | null
    const dueDate = formData.get('dueDate') as string | null
    const isRequired = formData.get('isRequired') === 'true'

    if (!file || !clubId || !title) {
      return NextResponse.json(
        { error: 'File, clubId, and title are required' },
        { status: 400 }
      )
    }

    // Only admins can upload forms
    const isAdminUser = await isAdmin(session.user.id, clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can upload forms' },
        { status: 403 }
      )
    }

    await requireMember(session.user.id, clubId)

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, Word, and image files are allowed.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = extensionForMime(file.type)
    const filename = `form-${timestamp}-${randomString}.${extension}`

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Save file
    const filePath = join(uploadsDir, filename)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create form in database
    const form = await prisma.form.create({
      data: {
        clubId,
        title,
        description,
        filename,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        filePath: `/uploads/${filename}`,
        dueDate: dueDate ? new Date(dueDate) : null,
        isRequired,
        uploadedById: session.user.id,
      },
      include: {
        submissions: true,
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    })

    return NextResponse.json({ form })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Upload form error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
