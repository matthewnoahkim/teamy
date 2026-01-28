import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tournaments/[tournamentId]/timeline - List all timeline items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = await params

    // Check if user has access to this tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        admins: true,
        hostingRequest: true,
        staff: {
          where: {
            OR: [
              { userId: session.user.id },
              { email: { equals: session.user.email || '', mode: 'insensitive' } },
            ],
          },
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const isCreator = tournament.createdById === session.user.id
    const isAdmin = tournament.admins.some(a => a.userId === session.user.id)
    const isDirector = tournament.hostingRequest?.directorEmail.toLowerCase() === session.user.email?.toLowerCase()
    const isStaff = tournament.staff.length > 0

    if (!isCreator && !isAdmin && !isDirector && !isStaff) {
      return NextResponse.json({ error: 'Not authorized to view timeline' }, { status: 403 })
    }

    const timeline = await prisma.tournamentTimeline.findMany({
      where: { tournamentId },
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json({ timeline })
  } catch (error) {
    console.error('Error fetching timeline:', error)
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 })
  }
}

// POST /api/tournaments/[tournamentId]/timeline - Create timeline item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = await params
    const body = await request.json()
    const { name, description, dueDate, type } = body as {
      name: string
      description?: string
      dueDate: string
      type: string
    }

    if (!name || !dueDate || !type) {
      return NextResponse.json({ error: 'Name, due date, and type are required' }, { status: 400 })
    }

    // Check if user is a TD
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        admins: true,
        hostingRequest: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const isCreator = tournament.createdById === session.user.id
    const isAdmin = tournament.admins.some(a => a.userId === session.user.id)
    const isDirector = tournament.hostingRequest?.directorEmail.toLowerCase() === session.user.email?.toLowerCase()

    if (!isCreator && !isAdmin && !isDirector) {
      return NextResponse.json({ error: 'Not authorized to create timeline items' }, { status: 403 })
    }

    const timelineItem = await prisma.tournamentTimeline.create({
      data: {
        tournamentId,
        name,
        description,
        dueDate: new Date(dueDate),
        type,
      },
    })

    return NextResponse.json({ timelineItem })
  } catch (error) {
    console.error('Error creating timeline item:', error)
    return NextResponse.json({ error: 'Failed to create timeline item' }, { status: 500 })
  }
}

// PUT /api/tournaments/[tournamentId]/timeline - Update timeline item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = await params
    const body = await request.json()
    const { id, name, description, dueDate, type } = body as {
      id: string
      name?: string
      description?: string
      dueDate?: string
      type?: string
    }

    if (!id) {
      return NextResponse.json({ error: 'Timeline item ID is required' }, { status: 400 })
    }

    // Check if user is a TD
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        admins: true,
        hostingRequest: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const isCreator = tournament.createdById === session.user.id
    const isAdmin = tournament.admins.some(a => a.userId === session.user.id)
    const isDirector = tournament.hostingRequest?.directorEmail.toLowerCase() === session.user.email?.toLowerCase()

    if (!isCreator && !isAdmin && !isDirector) {
      return NextResponse.json({ error: 'Not authorized to update timeline items' }, { status: 403 })
    }

    const timelineItem = await prisma.tournamentTimeline.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(type && { type }),
      },
    })

    return NextResponse.json({ timelineItem })
  } catch (error) {
    console.error('Error updating timeline item:', error)
    return NextResponse.json({ error: 'Failed to update timeline item' }, { status: 500 })
  }
}

// DELETE /api/tournaments/[tournamentId]/timeline - Delete timeline item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = await params
    const { searchParams } = new URL(request.url)
    const timelineId = searchParams.get('id')

    if (!timelineId) {
      return NextResponse.json({ error: 'Timeline item ID is required' }, { status: 400 })
    }

    // Check if user is a TD
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        admins: true,
        hostingRequest: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const isCreator = tournament.createdById === session.user.id
    const isAdmin = tournament.admins.some(a => a.userId === session.user.id)
    const isDirector = tournament.hostingRequest?.directorEmail.toLowerCase() === session.user.email?.toLowerCase()

    if (!isCreator && !isAdmin && !isDirector) {
      return NextResponse.json({ error: 'Not authorized to delete timeline items' }, { status: 403 })
    }

    await prisma.tournamentTimeline.delete({
      where: { id: timelineId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting timeline item:', error)
    return NextResponse.json({ error: 'Failed to delete timeline item' }, { status: 500 })
  }
}

