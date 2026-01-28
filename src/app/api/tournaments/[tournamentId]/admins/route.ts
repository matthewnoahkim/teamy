import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addAdminSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
}).refine((data) => data.userId || data.email, {
  message: "Either userId or email must be provided",
})

const removeAdminSchema = z.object({
  userId: z.string(),
})

// Helper to check if user is tournament admin
async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  return !!admin
}

// GET /api/tournaments/[tournamentId]/admins
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is tournament admin
    const isAdmin = await isTournamentAdmin(session.user.id, resolvedParams.tournamentId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only tournament admins can view admins' }, { status: 403 })
    }

    const admins = await prisma.tournamentAdmin.findMany({
      where: { tournamentId: resolvedParams.tournamentId },
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

    return NextResponse.json({ admins })
  } catch (error) {
    console.error('Get tournament admins error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tournaments/[tournamentId]/admins
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is tournament admin
    const isAdmin = await isTournamentAdmin(session.user.id, resolvedParams.tournamentId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only tournament admins can add admins' }, { status: 403 })
    }

    const body = await req.json()
    const validated = addAdminSchema.parse(body)

    // Find user by userId or email
    let user
    if (validated.userId) {
      user = await prisma.user.findUnique({
        where: { id: validated.userId },
      })
    } else if (validated.email) {
      user = await prisma.user.findUnique({
        where: { email: validated.email.toLowerCase().trim() },
      })
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already an admin
    const existing = await prisma.tournamentAdmin.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: resolvedParams.tournamentId,
          userId: user.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'User is already an admin' }, { status: 400 })
    }

    const admin = await prisma.tournamentAdmin.create({
      data: {
        tournamentId: resolvedParams.tournamentId,
        userId: user.id,
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

    return NextResponse.json({ admin })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Add tournament admin error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tournaments/[tournamentId]/admins
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is tournament admin
    const isAdmin = await isTournamentAdmin(session.user.id, resolvedParams.tournamentId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only tournament admins can remove admins' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Don't allow removing the creator
    const tournament = await prisma.tournament.findUnique({
      where: { id: resolvedParams.tournamentId },
      select: { createdById: true },
    })

    if (tournament?.createdById === userId) {
      return NextResponse.json({ error: 'Cannot remove the tournament creator' }, { status: 400 })
    }

    await prisma.tournamentAdmin.delete({
      where: {
        tournamentId_userId: {
          tournamentId: resolvedParams.tournamentId,
          userId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove tournament admin error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

