import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { revalidatePath } from 'next/cache'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB for background images
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

// POST - Upload background image
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can upload background images
    await requireAdmin(session.user.id, resolvedParams.clubId)

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Verify club exists
    const club = await prisma.club.findUnique({
      where: { id: resolvedParams.clubId },
    })

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Delete old background image if it exists
    if (club.backgroundImageUrl) {
      try {
        const oldFilePath = join(process.cwd(), 'public', club.backgroundImageUrl)
        if (existsSync(oldFilePath)) {
          await unlink(oldFilePath)
        }
      } catch (err) {
        console.error('Failed to delete old background image:', err)
        // Continue even if deletion fails
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `background-${timestamp}-${randomString}.${extension}`

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

    const imageUrl = `/uploads/${filename}`

    // Update club with new background image URL
    await prisma.club.update({
      where: { id: resolvedParams.clubId },
      data: {
        backgroundImageUrl: imageUrl,
        backgroundType: 'image',
      },
    })

    revalidatePath(`/club/${resolvedParams.clubId}`)

    return NextResponse.json({ imageUrl })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Background image upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete background image
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can delete background images
    await requireAdmin(session.user.id, resolvedParams.clubId)

    // Get club to find the image URL
    const club = await prisma.club.findUnique({
      where: { id: resolvedParams.clubId },
    })

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Delete file from filesystem
    if (club.backgroundImageUrl) {
      try {
        const filePath = join(process.cwd(), 'public', club.backgroundImageUrl)
        if (existsSync(filePath)) {
          await unlink(filePath)
        }
      } catch (err) {
        console.error('Failed to delete background image file:', err)
        // Continue even if file deletion fails
      }
    }

    // Update club to remove background image
    await prisma.club.update({
      where: { id: resolvedParams.clubId },
      data: {
        backgroundImageUrl: null,
        backgroundType: 'image', // Keep image type selected for future uploads
      },
    })

    revalidatePath(`/club/${resolvedParams.clubId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Delete background image error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

