import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { isTestAvailable, getClientIp, generateClientFingerprint, verifyTestPassword } from '@/lib/test-security'

// POST /api/tests/[testId]/attempts/start
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params if it's a Promise (Next.js 15 compatibility)
    const testId = resolvedParams.testId

    const body = await req.json()
    const { fingerprint, testPassword } = body

    // First, check if this test is linked to a tournament via TournamentTest
    const tournamentTest = await prisma.tournamentTest.findFirst({
      where: {
        testId: testId,
      },
      include: {
        tournament: {
          select: {
            id: true,
          },
        },
        event: {
          select: {
            id: true,
          },
        },
        test: {
          include: {
            assignments: true,
          },
        },
      },
    })

    let test: any = null
    let membership: any = null
    let isAdminUser = false
    let isTournamentTest = false

    if (tournamentTest && tournamentTest.test) {
      // This is a tournament test
      isTournamentTest = true
      test = tournamentTest.test

      // Get all user memberships to find their registered teams/clubs
      const userMemberships = await prisma.membership.findMany({
        where: {
          userId: session.user.id,
        },
        include: {
          club: {
            select: {
              id: true,
            },
          },
          team: {
            select: {
              id: true,
            },
          },
        },
      })

      // Get team IDs and club IDs from memberships
      const teamIds = userMemberships
        .map((m) => m.teamId)
        .filter((id): id is string => id !== null)
      const clubIds = userMemberships.map((m) => m.clubId)

      // Check if user is registered for this tournament
      const registration = await prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId: tournamentTest.tournament.id,
          status: 'CONFIRMED',
          OR: [
            { teamId: { in: teamIds } },
            { clubId: { in: clubIds } },
          ],
        },
      })

      if (!registration) {
        return NextResponse.json({ error: 'Not registered for this tournament' }, { status: 403 })
      }

      // Find the membership that matches this registration
      membership = registration.teamId
        ? userMemberships.find(
            (m) => m.clubId === registration.clubId && m.teamId === registration.teamId
          )
        : userMemberships.find((m) => m.clubId === registration.clubId)

      if (!membership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 403 })
      }

      // For tournament tests, check event assignment if test is event-specific
      if (tournamentTest.eventId) {
        const userEventAssignments = await prisma.rosterAssignment.findMany({
          where: {
            membershipId: membership.id,
            eventId: tournamentTest.eventId,
            ...(registration.teamId
              ? { teamId: registration.teamId }
              : {
                  team: {
                    clubId: registration.clubId,
                  },
                }),
          },
        })

        if (userEventAssignments.length === 0) {
          return NextResponse.json({ error: 'Not assigned to this event' }, { status: 403 })
        }
      }

      // Tournament tests don't have admin bypass
      isAdminUser = false
    } else {
      // Regular club test - check if test exists first
      test = await prisma.test.findUnique({
        where: { id: testId },
        include: {
          assignments: true,
        },
      })

      if (!test) {
        // Test doesn't exist as regular Test - check if it might be an ESTest
        const esTest = await prisma.eSTest.findUnique({
          where: { id: testId },
          include: {
            tournament: {
              select: { id: true },
            },
            event: {
              select: { id: true },
            },
          },
        })

        if (esTest) {
          // This is an ESTest - handle it similarly to tournament tests
          isTournamentTest = true
          
          // Check if tournament has ended - if so, block all test access
          const tournament = await prisma.tournament.findUnique({
            where: { id: esTest.tournament.id },
            select: { endDate: true, endTime: true },
          })

          if (tournament) {
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
            if (now >= tournamentEndDateTime) {
              return NextResponse.json(
                { error: 'Tournament has ended. Test access is no longer available.' },
                { status: 403 }
              )
            }
          }
          
          // Get all user memberships to find their registered teams/clubs
          const userMemberships = await prisma.membership.findMany({
            where: {
              userId: session.user.id,
            },
            include: {
              club: {
                select: {
                  id: true,
                },
              },
              team: {
                select: {
                  id: true,
                },
              },
            },
          })

          // Get team IDs and club IDs from memberships
          const teamIds = userMemberships
            .map((m) => m.teamId)
            .filter((id): id is string => id !== null)
          const clubIds = userMemberships.map((m) => m.clubId)

          // Check if user is registered for this tournament
          const registration = await prisma.tournamentRegistration.findFirst({
            where: {
              tournamentId: esTest.tournament.id,
              status: 'CONFIRMED',
              OR: [
                { teamId: { in: teamIds } },
                { clubId: { in: clubIds } },
              ],
            },
          })

          if (!registration) {
            return NextResponse.json({ error: 'Not registered for this tournament' }, { status: 403 })
          }

          // Find the membership that matches this registration
          membership = registration.teamId
            ? userMemberships.find(
                (m) => m.clubId === registration.clubId && m.teamId === registration.teamId
              )
            : userMemberships.find((m) => m.clubId === registration.clubId)

          if (!membership) {
            return NextResponse.json({ error: 'Membership not found' }, { status: 403 })
          }

          // For ESTest, check event assignment if test is event-specific
          if (esTest.eventId) {
            const userEventAssignments = await prisma.rosterAssignment.findMany({
              where: {
                membershipId: membership.id,
                eventId: esTest.eventId,
                ...(registration.teamId
                  ? { teamId: registration.teamId }
                  : {
                      team: {
                        clubId: registration.clubId,
                      },
                    }),
              },
            })

            if (userEventAssignments.length === 0) {
              return NextResponse.json({ error: 'Not assigned to this event' }, { status: 403 })
            }
          }

          // Check if ESTest is available
          const esTestAvailability = isTestAvailable({
            status: esTest.status,
            startAt: esTest.startAt,
            endAt: esTest.endAt,
            allowLateUntil: esTest.allowLateUntil,
          })
          if (!esTestAvailability.available) {
            return NextResponse.json(
              { error: esTestAvailability.reason },
              { status: 403 }
            )
          }

          // Check for existing in-progress or not-started ESTest attempt
          let attempt = await prisma.eSTestAttempt.findFirst({
            where: {
              membershipId: membership.id,
              testId: testId,
              status: {
                in: ['NOT_STARTED', 'IN_PROGRESS'],
              },
            },
            orderBy: { createdAt: 'desc' },
          })

          if (attempt) {
            // Resume existing attempt
            return NextResponse.json({ attempt })
          }

          // Create new ESTest attempt
          const ipAddress = getClientIp(req.headers)
          const userAgent = req.headers.get('user-agent')

          attempt = await prisma.eSTestAttempt.create({
            data: {
              testId: testId,
              membershipId: membership.id,
              status: 'IN_PROGRESS',
              startedAt: new Date(),
              clientFingerprintHash: fingerprint || null,
              ipAtStart: ipAddress,
              userAgentAtStart: userAgent,
            },
          })

          return NextResponse.json({ attempt }, { status: 201 })
        }

        // Test not found - log for debugging
        console.error(`Test not found: testId=${testId}, tournamentTest=${!!tournamentTest}`)
        return NextResponse.json({ error: 'Test not found' }, { status: 404 })
      }

      membership = await getUserMembership(session.user.id, test.clubId)
      if (!membership) {
        return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
      }

      // Check if user is admin (admins bypass password)
      isAdminUser = await isAdmin(session.user.id, test.clubId)
    }

    // Ensure we have a test and membership before proceeding
    if (!test || !membership) {
      return NextResponse.json({ error: 'Test or membership not found' }, { status: 404 })
    }

    // Verify test password if required (non-admins only)
    if (!isAdminUser && test.testPasswordHash) {
      if (!testPassword) {
        return NextResponse.json(
          { error: 'NEED_TEST_PASSWORD', message: 'Test password required' },
          { status: 401 }
        )
      }
      const isValid = await verifyTestPassword(
        test.testPasswordHash,
        testPassword
      )
      if (!isValid) {
        return NextResponse.json(
          { error: 'NEED_TEST_PASSWORD', message: 'Invalid test password' },
          { status: 401 }
        )
      }
    }

    // Check if test is available
    const availability = isTestAvailable(test)
    if (!availability.available) {
      return NextResponse.json(
        { error: availability.reason },
        { status: 403 }
      )
    }

    // Check assignment (admins bypass this check, tournament tests bypass this check)
    if (!isAdminUser && !isTournamentTest) {
      const hasAccess = test.assignments.some(
        (a: any) =>
          a.assignedScope === 'CLUB' ||
          (a.teamId && membership.teamId && a.teamId === membership.teamId) ||
          a.targetMembershipId === membership.id ||
          (a.eventId && membership.rosterAssignments?.some((ra: any) => ra.eventId === a.eventId))
      )

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Test not assigned to you' },
          { status: 403 }
        )
      }
    }

    // Check for existing in-progress or not-started attempt
    let attempt = await prisma.testAttempt.findFirst({
      where: {
        membershipId: membership.id,
        testId: testId,
        status: {
          in: ['NOT_STARTED', 'IN_PROGRESS'],
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (attempt) {
      // Resume existing attempt
      return NextResponse.json({ attempt })
    }

    // Check maxAttempts (if set) - count all completed attempts
    // Admins are also subject to attempt limits
    if (test.maxAttempts !== null) {
      const completedAttempts = await prisma.testAttempt.count({
        where: {
          membershipId: membership.id,
          testId: testId,
          status: {
            in: ['SUBMITTED', 'GRADED'],
          },
        },
      })

      if (completedAttempts >= test.maxAttempts) {
        return NextResponse.json(
          {
            error: 'Maximum attempts reached',
            message: `You have reached the maximum number of attempts (${test.maxAttempts}) for this test`,
          },
          { status: 403 }
        )
      }
    }

    // Create new attempt
    const ipAddress = getClientIp(req.headers)
    const userAgent = req.headers.get('user-agent')

    attempt = await prisma.testAttempt.create({
      data: {
        testId: testId,
        membershipId: membership.id,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        clientFingerprintHash: fingerprint || null,
        ipAtStart: ipAddress,
        userAgentAtStart: userAgent,
      },
    })

    return NextResponse.json({ attempt }, { status: 201 })
  } catch (error) {
    console.error('Start attempt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


