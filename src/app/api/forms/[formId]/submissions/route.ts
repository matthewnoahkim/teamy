import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, isAdmin, getUserMembership } from '@/lib/rbac'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]

// GET - Get all submissions for a form (admin only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formId = resolvedParams.formId

    // Find the form
    const form = await prisma.form.findUnique({
      where: { id: formId },
    })

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    await requireMember(session.user.id, form.clubId)

    // Only admins can view all submissions
    const isAdminUser = await isAdmin(session.user.id, form.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can view all submissions' },
        { status: 403 }
      )
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { formId },
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
      orderBy: {
        submittedAt: 'desc',
      },
    })

    // Get all team members to show who hasn't submitted
    const memberships = await prisma.membership.findMany({
      where: { teamId: form.clubId },
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

    const submittedUserIds = new Set(submissions.map(s => s.userId))
    const notSubmitted = memberships
      .filter(m => !submittedUserIds.has(m.userId))
      .map(m => m.user)

    return NextResponse.json({ submissions, notSubmitted })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get submissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Submit a signed form
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formId = resolvedParams.formId
    const formData = await req.formData()
    const file = formData.get('file') as File
    const notes = formData.get('notes') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Find the form
    const form = await prisma.form.findUnique({
      where: { id: formId },
    })

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    await requireMember(session.user.id, form.clubId)

    const membership = await getUserMembership(session.user.id, form.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check if user has already submitted
    const existingSubmission = await prisma.formSubmission.findUnique({
      where: {
        formId_userId: {
          formId,
          userId: session.user.id,
        },
      },
    })

    if (existingSubmission) {
      return NextResponse.json(
        { error: 'You have already submitted this form' },
        { status: 400 }
      )
    }

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
    const extension = file.name.split('.').pop()
    const filename = `submission-${timestamp}-${randomString}.${extension}`

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

    // Create submission in database
    const submission = await prisma.formSubmission.create({
      data: {
        formId,
        userId: session.user.id,
        membershipId: membership.id,
        filename,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        filePath: `/uploads/${filename}`,
        notes,
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

    return NextResponse.json({ submission })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Submit form error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

