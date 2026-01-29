import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

async function ensureAccess(sessionUserId: string, membershipId: string) {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { preferences: true },
  })

  if (!membership) {
    return { error: NextResponse.json({ error: 'Membership not found' }, { status: 404 }) }
  }

  const requesterMembership = await getUserMembership(sessionUserId, membership.clubId)
  if (!requesterMembership) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const isSelf = membership.userId === sessionUserId
  const isTeamAdmin = await isAdmin(sessionUserId, membership.clubId)

  if (!isSelf && !isTeamAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { membership }
}

async function deleteExistingFile(filePath?: string | null) {
  if (!filePath) return
  const absolute = join(process.cwd(), 'public', filePath)
  if (existsSync(absolute)) {
    try {
      await unlink(absolute)
    } catch (err) {
      console.error('Failed to delete member background image:', err)
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await ensureAccess(session.user.id, resolvedParams.membershipId)
    if (access.error) return access.error
    const membership = access.membership!

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

    // Remove old file if it exists
    if (membership.preferences?.backgroundImageUrl) {
      await deleteExistingFile(membership.preferences.backgroundImageUrl)
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'member-backgrounds')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `member-${membership.id}-${timestamp}-${randomString}.${extension}`
    const filePath = join(uploadsDir, filename)

    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const imageUrl = `/uploads/member-backgrounds/${filename}`

    const preferences = await prisma.memberPreferences.upsert({
      where: { membershipId: membership.id },
      update: {
        backgroundImageUrl: imageUrl,
        backgroundType: 'image',
      },
      create: {
        membershipId: membership.id,
        preferredEvents: [],
        avoidEvents: [],
        backgroundType: 'image',
        backgroundImageUrl: imageUrl,
      },
    })

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Upload member background image error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await ensureAccess(session.user.id, resolvedParams.membershipId)
    if (access.error) return access.error
    const membership = access.membership!

    if (!membership.preferences?.backgroundImageUrl) {
      return NextResponse.json({ preferences: membership.preferences })
    }

    await deleteExistingFile(membership.preferences.backgroundImageUrl)

    const preferences = await prisma.memberPreferences.upsert({
      where: { membershipId: membership.id },
      update: {
        backgroundImageUrl: null,
        backgroundType: 'grid',
      },
      create: {
        membershipId: membership.id,
        preferredEvents: [],
        avoidEvents: [],
        backgroundType: 'grid',
        backgroundImageUrl: null,
      },
    })

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Delete member background image error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

