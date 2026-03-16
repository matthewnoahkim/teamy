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

    // Batch-update all ESTests to mark scores as released
    let updatedCount = 0
    const esTestIds = esTests.map(t => t.id)
    console.log(`[Release All Scores] Attempting to update ${esTestIds.length} ESTests:`, esTestIds)

    if (esTestIds.length > 0) {
      try {
        const esResult = await prisma.eSTest.updateMany({
          where: { id: { in: esTestIds } },
          data: { scoresReleased: true },
        })
        updatedCount += esResult.count
        console.log(`[Release All Scores] Updated ${esResult.count} ESTests`)
      } catch (error: unknown) {
        const errCode = (error as Record<string, unknown>)?.code
        const errMessage = error instanceof Error ? error.message : undefined
        if (
          errCode === 'P2022' ||
          errMessage?.includes('does not exist') ||
          errMessage?.includes('Unknown argument') ||
          errMessage?.includes('Unknown field')
        ) {
          console.warn('scoresReleased column does not exist for ESTest')
        } else {
          console.error('Error batch-updating ESTests:', error)
          throw error
        }
      }
    }

    // Batch-update all regular tests to set releaseScoresAt to now
    const releaseTime = new Date()
    const regularTestIds = regularTests.map(t => t.id)
    if (regularTestIds.length > 0) {
      try {
        const regularResult = await prisma.test.updateMany({
          where: { id: { in: regularTestIds } },
          data: { releaseScoresAt: releaseTime },
        })
        updatedCount += regularResult.count
        console.log(`[Release All Scores] Updated ${regularResult.count} regular tests`)
      } catch (error: unknown) {
        console.error('Error batch-updating regular tests:', error)
        // Don't throw - continue
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
