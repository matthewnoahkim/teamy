import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Helper to check if user is a tournament director for a tournament
async function isTournamentDirector(userId: string, userEmail: string, tournamentId: string): Promise<boolean> {
  // Check if user is tournament admin
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  
  if (admin) return true
  
  // Check if user created the tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  if (tournament?.createdById === userId) return true
  
  // Check if user is the director on the hosting request
  const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
    where: {
      tournament: {
        id: tournamentId,
      },
      directorEmail: {
        equals: userEmail,
        mode: 'insensitive',
      },
      status: 'APPROVED',
    },
  })
  
  if (hostingRequest) return true
  
  // Also check if user is a TD via TournamentStaff
  const staffRecord = await prisma.tournamentStaff.findFirst({
    where: {
      tournamentId,
      role: 'TOURNAMENT_DIRECTOR',
      status: 'ACCEPTED',
      OR: [
        { userId },
        {
          email: {
            equals: userEmail,
            mode: 'insensitive',
          },
        },
      ],
    },
  })
  
  return !!staffRecord
}

// GET /api/td/tournaments/[tournamentId]/audit-logs
// Get audit logs for all tests in a tournament
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params if it's a Promise (Next.js 15 compatibility)
    const tournamentId = resolvedParams.tournamentId

    // Check if user is tournament director
    const isTD = await isTournamentDirector(session.user.id, session.user.email, tournamentId)
    if (!isTD) {
      return NextResponse.json({ error: 'Only tournament directors can view audit logs' }, { status: 403 })
    }

    // Get all ESTest IDs for this tournament
    const esTests = await prisma.eSTest.findMany({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        id: true,
      },
    })

    const esTestIds = esTests.map(t => t.id)

    // Get all clubs registered for this tournament (needed for filtering deleted tests)
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        clubId: true,
      },
    })

    const clubIds = registrations.map(r => r.clubId)

    // Get test IDs from TournamentTest - only tests actually linked to this tournament
    const tournamentTests = await prisma.tournamentTest.findMany({
      where: {
        tournamentId: tournamentId,
      },
      select: {
        testId: true,
      },
    })

    const linkedTestIds = tournamentTests.map(tt => tt.testId)
    const allTestIds = linkedTestIds

    // Fetch audit logs for regular Test models
    // Query all audit logs - includes logs for deleted tests (testId will be null after migration)
    // Limit to most recent 1000 for performance
    const testAuditWhere: any = {
      OR: [
        // Deleted tests - we'll filter these by clubId in details after fetching
        {
          testId: null,
        },
      ],
    }
    
    // Add condition for existing tests if we have any
    if (allTestIds.length > 0) {
      testAuditWhere.OR.unshift({
        testId: {
          in: allTestIds,
        },
      })
    }
    
    const allTestAudits = await prisma.testAudit.findMany({
      where: testAuditWhere,
      include: {
        test: {
          select: {
            id: true,
            name: true,
            clubId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // Limit to most recent 1000 audit logs for performance
    })

    // Filter audit logs to only include tests linked to this tournament
    // For existing tests, check if testId is in linkedTestIds
    // For deleted tests, check tournamentIds stored in the audit log details
    const testAudits = allTestAudits.filter(audit => {
      if (audit.test) {
        // Test still exists - check if it's linked to this tournament
        return linkedTestIds.includes(audit.test.id)
      } else if (audit.testId === null) {
        // Test was deleted and testId is null - check tournamentIds in details
        const details = audit.details as any
        if (details?.tournamentIds && Array.isArray(details.tournamentIds)) {
          return details.tournamentIds.includes(tournamentId)
        }
        return false
      } else {
        // Test was deleted but testId is still in audit log - check tournamentIds in details
        const details = audit.details as any
        if (details?.tournamentIds && Array.isArray(details.tournamentIds)) {
          return details.tournamentIds.includes(tournamentId)
        }
        // Fallback: check if testId was in linkedTestIds (for older audit logs without tournamentIds)
        return linkedTestIds.includes(audit.testId)
      }
    })

    // Fetch membership and user info for each audit log
    const testAuditsWithUsers = await Promise.all(
      testAudits.map(async (audit) => {
        const membership = await prisma.membership.findUnique({
          where: { id: audit.actorMembershipId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
        return {
          ...audit,
          actorMembership: membership,
        }
      })
    )

    // Fetch ESTest audit logs (now we have proper audit tracking)
    // Include both existing and deleted tests (testId will be null for deleted tests)
    let allESTestAuditsRaw: any[] = []
    try {
      allESTestAuditsRaw = await prisma.eSTestAudit.findMany({
        where: {
          OR: [
            // Tests that still exist
            {
              test: {
                tournamentId: tournamentId,
              },
            },
            // Deleted tests - filter by tournamentId stored in details
            {
              testId: null,
            },
          ],
        },
        include: {
          test: {
            select: {
              id: true,
              name: true,
              tournamentId: true,
              event: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          actorStaff: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1000, // Limit to most recent 1000 for performance
      })
    } catch (error: any) {
      // If ESTestAudit table doesn't exist yet, just use empty array
      console.warn('ESTestAudit table may not exist yet:', error?.message)
      allESTestAuditsRaw = []
    }

    // Filter ESTest audit logs to only include those from this tournament
    // For deleted tests, check tournamentId in details
    const esTestAuditsRaw = allESTestAuditsRaw.filter(audit => {
      if (audit.test) {
        // Test still exists - check tournament
        return audit.test.tournamentId === tournamentId
      } else if (audit.testId === null) {
        // Test was deleted - check tournamentId in details
        const details = audit.details as any
        if (details?.tournamentId && typeof details.tournamentId === 'string') {
          return details.tournamentId === tournamentId
        }
        return false
      }
      return false
    })

    // Format ESTest audit logs
    const esTestAudits = esTestAuditsRaw
      .filter(audit => audit.actorStaff) // Filter out any audits with missing staff
      .map(audit => {
        const testName = audit.test?.name || 
                        (audit.details && typeof audit.details === 'object' && 'testName' in audit.details 
                          ? (audit.details as any).testName 
                          : 'Deleted Test')
        
        const eventName = audit.test?.event?.name ||
                         (audit.details && typeof audit.details === 'object' && 'eventName' in audit.details
                           ? (audit.details as any).eventName
                           : null)
        
        return {
          id: audit.id,
          testId: audit.test?.id || audit.testId,
          testName: testName,
          eventName: eventName,
          testType: 'ESTest' as const,
          action: audit.action,
          actorName: audit.actorStaff!.name || audit.actorStaff!.email,
          actorEmail: audit.actorStaff!.email,
          createdAt: audit.createdAt,
          details: audit.details,
        }
      })

    // Combine and format audit logs
    // Use test name from details if test was deleted, otherwise use test.name
    const formattedTestAudits = testAuditsWithUsers
      .filter(audit => audit.actorMembership) // Filter out any audits with missing memberships
      .map(audit => {
        // If test exists, use its name, otherwise try to get from details
        const testName = audit.test?.name || 
                        (audit.details && typeof audit.details === 'object' && 'testName' in audit.details 
                          ? (audit.details as any).testName 
                          : 'Deleted Test')
        
        return {
          id: audit.id,
          testId: audit.test?.id || audit.testId, // Use testId from audit if test is deleted
          testName: testName,
          testType: 'Test' as const,
          action: audit.action,
          actorName: audit.actorMembership!.user.name || audit.actorMembership!.user.email,
          actorEmail: audit.actorMembership!.user.email,
          createdAt: audit.createdAt,
          details: audit.details,
        }
      })

    // Combine all audit logs and sort by date
    const allAudits = [...formattedTestAudits, ...esTestAudits].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ auditLogs: allAudits })
  } catch (error: any) {
    console.error('Error fetching tournament audit logs:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    })
    return NextResponse.json({ 
      error: 'Failed to fetch audit logs',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 })
  }
}

