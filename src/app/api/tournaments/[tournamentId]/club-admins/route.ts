import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Helper to check if user is tournament admin
async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      createdBy: true,
      admins: {
        where: { userId },
      },
    },
  })
  
  if (!tournament) return false
  
  // User is admin if they created the tournament or are in the admins list
  return tournament.createdById === userId || tournament.admins.length > 0
}

// GET /api/tournaments/[tournamentId]/club-admins?clubIds=id1,id2,id3
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get club IDs from query params
    const { searchParams } = new URL(req.url)
    const clubIdsParam = searchParams.get('clubIds')
    
    if (!clubIdsParam) {
      return NextResponse.json({ error: 'clubIds parameter is required' }, { status: 400 })
    }

    const clubIds = clubIdsParam.split(',').filter(id => id.trim().length > 0)
    
    if (clubIds.length === 0) {
      return NextResponse.json({ adminEmails: [] })
    }

    // Fetch all admins for the specified clubs
    const admins = await prisma.membership.findMany({
      where: {
        clubId: { in: clubIds },
        role: 'ADMIN',
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    })

    // Extract unique email addresses
    const adminEmails = [...new Set(admins.map(admin => admin.user.email).filter(Boolean))]

    return NextResponse.json({ adminEmails })
  } catch (error: any) {
    console.error('Error fetching club admins:', error)
    return NextResponse.json(
      { error: 'Failed to fetch club admins' },
      { status: 500 }
    )
  }
}

