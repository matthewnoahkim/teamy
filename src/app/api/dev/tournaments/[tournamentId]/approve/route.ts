import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/dev/tournaments/[tournamentId]/approve
// Allows dev panel users to approve tournaments without requiring tournament admin status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle both sync and async params (Next.js 13 vs 15)

    const tournamentId = resolvedParams.tournamentId
    
    const body = await req.json()
    const approved = body.approved !== undefined ? body.approved : true
    const rejectionReason = body.rejectionReason || null

    // Update tournament approval status
    // If approving, clear rejection reason; if rejecting, set it
    const tournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: { 
        approved,
        rejectionReason: approved ? null : rejectionReason,
      },
    })

    return NextResponse.json({ tournament })
  } catch (error) {
    console.error('Approve tournament error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 })
  }
}

