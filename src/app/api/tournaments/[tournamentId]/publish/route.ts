import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = resolvedParams
    const body = await request.json()
    const { published } = body

    if (typeof published !== 'boolean') {
      return NextResponse.json({ error: 'Invalid published value' }, { status: 400 })
    }

    // Check if user has permission to manage this tournament
    // User must be the creator or a tournament director
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        createdById: true,
        hostingRequest: {
          select: {
            directorEmail: true,
          },
        },
        staff: {
          where: {
            role: 'TOURNAMENT_DIRECTOR',
            status: 'ACCEPTED',
          },
          select: {
            userId: true,
            email: true,
          },
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Check permission
    const isCreator = tournament.createdById === session.user.id
    const isDirectorByEmail = tournament.hostingRequest?.directorEmail?.toLowerCase() === session.user.email?.toLowerCase()
    const isStaffDirector = tournament.staff.some(
      s => s.userId === session.user.id || s.email.toLowerCase() === session.user.email?.toLowerCase()
    )

    if (!isCreator && !isDirectorByEmail && !isStaffDirector) {
      return NextResponse.json({ error: 'You do not have permission to manage this tournament' }, { status: 403 })
    }

    // Update the tournament
    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: { published },
      select: {
        id: true,
        published: true,
      },
    })

    return NextResponse.json({ success: true, published: updated.published })
  } catch (error) {
    console.error('Error updating tournament publish status:', error)
    return NextResponse.json({ error: 'Failed to update publish status' }, { status: 500 })
  }
}

