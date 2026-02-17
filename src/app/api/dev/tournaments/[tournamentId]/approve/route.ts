import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDevAccess } from '@/lib/dev/guard'

// PATCH /api/dev/tournaments/[tournamentId]/approve
// Allows dev panel users to approve tournaments without requiring tournament admin status. Protected by requireDevAccess.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const guard = await requireDevAccess(req, '/api/dev/tournaments/[tournamentId]/approve')
  if (!guard.allowed) return guard.response

  const resolvedParams = await params
  try {
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

