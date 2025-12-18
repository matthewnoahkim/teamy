import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch study notes for a user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clubId = searchParams.get('clubId')
    const membershipId = searchParams.get('membershipId')

    if (!clubId || !membershipId) {
      return NextResponse.json({ error: 'Missing clubId or membershipId' }, { status: 400 })
    }

    // Verify the user has access to this membership
    const membership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        clubId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const notes = await prisma.studyNote.findMany({
      where: {
        clubId,
        membershipId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Failed to fetch study notes:', error)
    return NextResponse.json({ error: 'Failed to fetch study notes' }, { status: 500 })
  }
}

// POST - Create a new study note
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clubId, membershipId, eventSlug, title, content, noteType, sheetCount } = body

    if (!clubId || !membershipId || !eventSlug || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the user has access to this membership
    const membership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        clubId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const note = await prisma.studyNote.create({
      data: {
        clubId,
        membershipId,
        eventSlug,
        title,
        content: content || '',
        noteType: noteType || 'NOTE_SHEET',
        sheetCount: sheetCount || 1,
      },
    })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Failed to create study note:', error)
    return NextResponse.json({ error: 'Failed to create study note' }, { status: 500 })
  }
}

// PUT - Update an existing study note
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, clubId, membershipId, eventSlug, title, content, noteType, sheetCount } = body

    // If we have an ID, update by ID
    if (id) {
      const existingNote = await prisma.studyNote.findUnique({
        where: { id },
      })

      if (!existingNote) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 })
      }

      // Verify the user has access to this membership
      const membership = await prisma.membership.findFirst({
        where: {
          id: existingNote.membershipId,
          userId: session.user.id,
        },
      })

      if (!membership) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const note = await prisma.studyNote.update({
        where: { id },
        data: {
          title,
          content,
          noteType,
          sheetCount,
        },
      })

      return NextResponse.json({ note })
    }

    // Otherwise, upsert by clubId, membershipId, eventSlug
    if (!clubId || !membershipId || !eventSlug) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the user has access to this membership
    const membership = await prisma.membership.findFirst({
      where: {
        id: membershipId,
        clubId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const note = await prisma.studyNote.upsert({
      where: {
        clubId_membershipId_eventSlug: {
          clubId,
          membershipId,
          eventSlug,
        },
      },
      update: {
        title,
        content,
        noteType,
        sheetCount,
      },
      create: {
        clubId,
        membershipId,
        eventSlug,
        title: title || `${eventSlug} Notes`,
        content: content || '',
        noteType: noteType || 'NOTE_SHEET',
        sheetCount: sheetCount || 1,
      },
    })

    return NextResponse.json({ note })
  } catch (error) {
    console.error('Failed to update study note:', error)
    return NextResponse.json({ error: 'Failed to update study note' }, { status: 500 })
  }
}

// DELETE - Delete a study note
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing note ID' }, { status: 400 })
    }

    const existingNote = await prisma.studyNote.findUnique({
      where: { id },
    })

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    // Verify the user has access to this membership
    const membership = await prisma.membership.findFirst({
      where: {
        id: existingNote.membershipId,
        userId: session.user.id,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.studyNote.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete study note:', error)
    return NextResponse.json({ error: 'Failed to delete study note' }, { status: 500 })
  }
}

