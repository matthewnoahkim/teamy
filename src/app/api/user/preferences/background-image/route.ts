import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { extensionForMime, resolveSafePublicUploadPath } from '@/lib/upload-security'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

async function deleteExistingFile(filePath?: string | null) {
  if (!filePath) return
  const absolute = resolveSafePublicUploadPath(filePath)
  if (!absolute) return
  if (existsSync(absolute)) {
    try {
      await unlink(absolute)
    } catch (err) {
      console.error('Failed to delete user background image:', err)
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Get current preferences to check for existing image
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })

    const currentPreferences = (user?.preferences as Record<string, unknown>) || {}

    // Remove old file if it exists
    if (currentPreferences.backgroundImageUrl) {
      await deleteExistingFile(currentPreferences.backgroundImageUrl as string)
    }

    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'user-backgrounds')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = extensionForMime(file.type, 'jpg')
    const filename = `user-${session.user.id}-${timestamp}-${randomString}.${extension}`
    const filePath = join(uploadsDir, filename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const imageUrl = `/uploads/user-backgrounds/${filename}`

    // Update user preferences
    const updatedPreferences = {
      ...currentPreferences,
      backgroundType: 'image',
      backgroundImageUrl: imageUrl,
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: updatedPreferences },
    })

    return NextResponse.json({ backgroundImageUrl: imageUrl })
  } catch (error) {
    console.error('Upload user background image error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })

    const currentPreferences = (user?.preferences as Record<string, unknown>) || {}

    // Delete image file if exists
    if (currentPreferences.backgroundImageUrl) {
      await deleteExistingFile(currentPreferences.backgroundImageUrl as string)
    }

    // Update preferences to remove image
    const updatedPreferences = {
      ...currentPreferences,
      backgroundType: 'grid',
      backgroundImageUrl: null,
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: updatedPreferences },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user background image error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
