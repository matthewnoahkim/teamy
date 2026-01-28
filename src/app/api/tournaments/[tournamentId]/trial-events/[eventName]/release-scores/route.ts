import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTournamentAdmin, isTournamentDirector } from '@/lib/rbac'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// POST /api/tournaments/[tournamentId]/trial-events/[eventName]/release-scores
// Release scores for all published tests in a specific trial event (tournament director/admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; eventName: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const { tournamentId, eventName } = resolvedParams
    const decodedEventName = decodeURIComponent(eventName)

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

    // Get all published tests for this tournament with null eventId (trial events)
    const allTrialTests = await prisma.eSTest.findMany({
      where: {
        tournamentId,
        eventId: null,
        status: 'PUBLISHED',
      },
      select: { id: true },
    })

    // Get event names from CREATE audit logs for these tests
    const testIds = allTrialTests.map(t => t.id)
    const createAudits = await prisma.eSTestAudit.findMany({
      where: {
        testId: { in: testIds },
        action: 'CREATE',
      },
      select: {
        testId: true,
        details: true,
      },
    })

    // Filter tests that match the trial event name
    const matchingTestIds = createAudits
      .filter(audit => {
        if (audit.details && typeof audit.details === 'object' && 'eventName' in audit.details) {
          const auditEventName = (audit.details as any).eventName
          return auditEventName && typeof auditEventName === 'string' && auditEventName === decodedEventName
        }
        return false
      })
      .map(audit => audit.testId)
      .filter((id): id is string => id !== null)

    // Update all matching tests to mark scores as released
    let updatedCount = 0
    console.log(`[Release Trial Event Scores] Found ${matchingTestIds.length} tests for trial event "${decodedEventName}":`, matchingTestIds)
    
    for (const testId of matchingTestIds) {
      try {
        // First, verify the test exists and get current value
        const before = await prisma.eSTest.findUnique({
          where: { id: testId },
          select: { id: true, scoresReleased: true, name: true },
        })
        console.log(`[Release Trial Event Scores] Test ${testId} (${before?.name}): before update scoresReleased =`, before?.scoresReleased)
        
        const updated = await prisma.eSTest.update({
          where: { id: testId },
          data: { scoresReleased: true },
          select: { id: true, scoresReleased: true, name: true },
        })
        console.log(`[Release Trial Event Scores] Test ${testId} (${updated.name}): after update scoresReleased =`, updated.scoresReleased)
        
        // Verify the update worked
        const verify = await prisma.eSTest.findUnique({
          where: { id: testId },
          select: { id: true, scoresReleased: true },
        })
        console.log(`[Release Trial Event Scores] Test ${testId}: verification query scoresReleased =`, verify?.scoresReleased)
        
        updatedCount++
      } catch (error: any) {
        // If the column doesn't exist, skip this test
        if (error?.code === 'P2025' || error?.message?.includes('does not exist')) {
          console.warn(`scoresReleased column does not exist for test ${testId}`)
        } else {
          console.error(`Error updating test ${testId}:`, error)
          throw error
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Scores released for ${updatedCount} test(s)`,
      count: updatedCount
    })
  } catch (error) {
    console.error('Release trial event scores error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
