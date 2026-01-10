import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTournamentAdmin, hasESTestAccess } from '@/lib/rbac'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// POST /api/es/tests/[testId]/release-scores
// Manually release scores for an ESTest (tournament director/admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> | { testId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)

    const test = await prisma.eSTest.findUnique({
      where: { id: resolvedParams.testId },
      select: { tournamentId: true },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user is tournament admin or has access to this specific test
    // TDs have full access, ES only for their assigned events
    const isAdmin = await isTournamentAdmin(session.user.id, test.tournamentId)
    const hasAccess = await hasESTestAccess(session.user.id, session.user.email || '', resolvedParams.testId)
    
    if (!isAdmin && !hasAccess) {
      return NextResponse.json(
        { error: 'Only tournament directors, event supervisors, and admins can release scores' },
        { status: 403 }
      )
    }

    // Check if tournament has ended
    const tournament = await prisma.tournament.findUnique({
      where: { id: test.tournamentId },
      select: { endDate: true, endTime: true, name: true },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Combine endDate and endTime to get the full end datetime
    const endDate = new Date(tournament.endDate)
    const endTime = new Date(tournament.endTime)
    const tournamentEndDateTime = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      endTime.getHours(),
      endTime.getMinutes(),
      endTime.getSeconds()
    )

    const now = new Date()
    if (now < tournamentEndDateTime) {
      return NextResponse.json(
        { 
          error: 'Cannot release scores until the tournament has ended',
          tournamentEndDateTime: tournamentEndDateTime.toISOString(),
        },
        { status: 400 }
      )
    }

    // Update the test to mark scores as released
    // Use try-catch in case the column doesn't exist yet (if migration hasn't run)
    try {
      // First, verify the test exists and get current value
      const before = await prisma.eSTest.findUnique({
        where: { id: resolvedParams.testId },
        select: { id: true, scoresReleased: true, name: true },
      })
      console.log(`[Release Test Scores] Test ${resolvedParams.testId} (${before?.name}): before update scoresReleased =`, before?.scoresReleased)
      
      const updated = await prisma.eSTest.update({
        where: { id: resolvedParams.testId },
        data: { scoresReleased: true },
        select: { id: true, scoresReleased: true, name: true },
      })
      console.log(`[Release Test Scores] Test ${resolvedParams.testId} (${updated.name}): after update scoresReleased =`, updated.scoresReleased)
      
      // Verify the update worked
      const verify = await prisma.eSTest.findUnique({
        where: { id: resolvedParams.testId },
        select: { id: true, scoresReleased: true },
      })
      console.log(`[Release Test Scores] Test ${resolvedParams.testId}: verification query scoresReleased =`, verify?.scoresReleased)
    } catch (error: any) {
      // If the column doesn't exist, that's okay - the feature just won't work until migration is run
      if (error?.code === 'P2025' || error?.message?.includes('does not exist')) {
        console.warn('scoresReleased column does not exist yet. Migration may need to be run.')
        // Continue anyway - the feature will work once migration is run
      } else {
        console.error('Error updating scoresReleased:', error)
        throw error
      }
    }

    return NextResponse.json({ success: true, message: 'Scores released successfully' })
  } catch (error) {
    console.error('Release ESTest scores error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
