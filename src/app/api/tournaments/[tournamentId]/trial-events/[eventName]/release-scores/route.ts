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
          const auditEventName = (audit.details as Record<string, unknown>).eventName
          return auditEventName && typeof auditEventName === 'string' && auditEventName === decodedEventName
        }
        return false
      })
      .map(audit => audit.testId)
      .filter((id): id is string => id !== null)

    // Batch-update all matching tests to mark scores as released
    let updatedCount = 0
    console.log(`[Release Trial Event Scores] Found ${matchingTestIds.length} tests for trial event "${decodedEventName}":`, matchingTestIds)

    if (matchingTestIds.length > 0) {
      try {
        const result = await prisma.eSTest.updateMany({
          where: { id: { in: matchingTestIds } },
          data: { scoresReleased: true },
        })
        updatedCount = result.count
        console.log(`[Release Trial Event Scores] Updated ${result.count} tests`)
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
          console.error('Error batch-updating trial event tests:', error)
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
