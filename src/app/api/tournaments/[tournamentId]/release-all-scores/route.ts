import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTournamentAdmin, isTournamentDirector } from '@/lib/rbac'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// POST /api/tournaments/[tournamentId]/release-all-scores
// Release scores for all published tests in a tournament (tournament director/admin only)
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


    const tournamentId = resolvedParams.tournamentId

    // Check if user is tournament director or admin
    const isAdmin = await isTournamentAdmin(session.user.id, tournamentId)
    const isTD = await isTournamentDirector(session.user.id, session.user.email || '', tournamentId)
    
    if (!isAdmin && !isTD) {
      return NextResponse.json(
        { error: 'Only tournament directors and admins can release scores' },
        { status: 403 }
      )
    }

    // Check if tournament has ended
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
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

    // Get all published ESTests for this tournament
    const esTests = await prisma.eSTest.findMany({
      where: {
        tournamentId,
        status: 'PUBLISHED',
      },
      select: { id: true, name: true, status: true },
    })
    console.log(`[Release All Scores] Found ${esTests.length} published ESTests in tournament ${tournamentId}:`, esTests.map(t => ({ id: t.id, name: t.name, status: t.status })))

    // Get all published regular tests (via TournamentTest) for this tournament
    const tournamentTests = await prisma.tournamentTest.findMany({
      where: {
        tournamentId,
      },
      include: {
        test: {
          select: { id: true, name: true, status: true },
        },
      },
    })
    const regularTests = tournamentTests.filter(tt => tt.test.status === 'PUBLISHED').map(tt => tt.test)
    console.log(`[Release All Scores] Found ${regularTests.length} published regular tests in tournament ${tournamentId}:`, regularTests.map(t => ({ id: t.id, name: t.name, status: t.status })))

    // Update all ESTests to mark scores as released
    let updatedCount = 0
    const esTestIds = esTests.map(t => t.id)
    console.log(`[Release All Scores] Attempting to update ${esTestIds.length} ESTests:`, esTestIds)
    
    for (const test of esTests) {
      try {
        // First, verify the test exists and get current value
        const before = await prisma.eSTest.findUnique({
          where: { id: test.id },
          select: { id: true, scoresReleased: true, name: true },
        })
        console.log(`[Release All Scores] Test ${test.id} (${before?.name}): before update scoresReleased =`, before?.scoresReleased)
        
        const updated = await prisma.eSTest.update({
          where: { id: test.id },
          data: { scoresReleased: true },
          select: { id: true, scoresReleased: true, name: true },
        })
        console.log(`[Release All Scores] Test ${test.id} (${updated.name}): after update scoresReleased =`, updated.scoresReleased)
        
        // Verify the update worked
        const verify = await prisma.eSTest.findUnique({
          where: { id: test.id },
          select: { id: true, scoresReleased: true },
        })
        console.log(`[Release All Scores] Test ${test.id}: verification query scoresReleased =`, verify?.scoresReleased)
        
        updatedCount++
      } catch (error: any) {
        // If the column doesn't exist, skip this test
        if (error?.code === 'P2025' || error?.message?.includes('does not exist')) {
          console.warn(`scoresReleased column does not exist for test ${test.id}`)
        } else {
          console.error(`Error updating ESTest ${test.id}:`, error)
          throw error
        }
      }
    }

    // Update all regular tests to set releaseScoresAt to now
    const releaseTime = new Date()
    for (const test of regularTests) {
      try {
        const before = await prisma.test.findUnique({
          where: { id: test.id },
          select: { id: true, releaseScoresAt: true, name: true },
        })
        console.log(`[Release All Scores] Regular test ${test.id} (${before?.name}): before update releaseScoresAt =`, before?.releaseScoresAt)
        
        const updated = await prisma.test.update({
          where: { id: test.id },
          data: { releaseScoresAt: releaseTime },
          select: { id: true, releaseScoresAt: true, name: true },
        })
        console.log(`[Release All Scores] Regular test ${test.id} (${updated.name}): after update releaseScoresAt =`, updated.releaseScoresAt)
        
        updatedCount++
      } catch (error: any) {
        console.error(`Error updating regular test ${test.id}:`, error)
        // Don't throw - continue with other tests
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Scores released for ${updatedCount} test(s)`,
      count: updatedCount
    })
  } catch (error) {
    console.error('Release all scores error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
