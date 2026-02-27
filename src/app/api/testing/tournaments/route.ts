import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serverSession } from '@/lib/server-session'

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/testing/tournaments
// Get all tournaments the user's teams are registered for, with their assigned events and released tests
export async function GET(_req: NextRequest) {
  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all memberships for the user
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        club: {
          select: {
            id: true,
            name: true,
            division: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (memberships.length === 0) {
      return NextResponse.json({ tournaments: [] })
    }

    // Get all team IDs from memberships
    const teamIds = memberships
      .map((m) => m.teamId)
      .filter((id): id is string => id !== null)

    // Get all club IDs
    const clubIds = memberships.map((m) => m.clubId)

    // Get tournament registrations for these teams and clubs
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        OR: [
          { teamId: { in: teamIds } },
          { clubId: { in: clubIds } },
        ],
        status: 'CONFIRMED',
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            division: true,
            startDate: true,
            endDate: true,
            endTime: true,
            location: true,
            slug: true,
            trialEvents: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Deduplicate tournaments by tournament ID (linear time)
    const uniqueRegistrations = Array.from(
      new Map(registrations.map((registration) => [registration.tournament.id, registration])).values()
    )

    // For each registration, get the user's event assignments and tests
    const tournamentsWithData = await Promise.all(
      uniqueRegistrations.map(async (registration) => {
        // Find the membership that matches this registration
        // Prefer team-specific membership if teamId is set, otherwise any membership in the club
        const membership = registration.teamId
          ? memberships.find(
              (m) => m.clubId === registration.clubId && m.teamId === registration.teamId
            )
          : memberships.find((m) => m.clubId === registration.clubId)

        if (!membership) {
          return null
        }

        // Tournament-specific member assignments drive portal visibility.
        const [memberEventAssignments, memberTrialEventAssignments] = await Promise.all([
          prisma.tournamentMemberEventAssignment.findMany({
            where: {
              registrationId: registration.id,
              membershipId: membership.id,
            },
            include: {
              event: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  division: true,
                },
              },
            },
          }),
          prisma.tournamentMemberTrialEventAssignment.findMany({
            where: {
              registrationId: registration.id,
              membershipId: membership.id,
            },
            select: {
              eventName: true,
              eventDivision: true,
            },
          }),
        ])

        const assignedEventIds = memberEventAssignments.map((assignment) => assignment.event.id)

        // Get released tests for assigned events in this tournament.
        // Event-less tests are fetched and then split into trial/general buckets below.
        const [tournamentTests, esTests] = await Promise.all([
          // Regular Test records linked via TournamentTest
          prisma.tournamentTest.findMany({
            where: {
              tournamentId: registration.tournamentId,
              OR: [
                { eventId: { in: assignedEventIds } },
                { eventId: null }, // Tests not assigned to a specific event
              ],
            },
            include: {
              test: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  instructions: true,
                  status: true,
                  durationMinutes: true,
                  startAt: true,
                  endAt: true,
                  allowLateUntil: true,
                  requireFullscreen: true,
                  allowCalculator: true,
                  calculatorType: true,
                  allowNoteSheet: true,
                  noteSheetInstructions: true,
                  maxAttempts: true,
                  scoreReleaseMode: true,
                  releaseScoresAt: true,
                  clubId: true,
                  club: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                  _count: {
                    select: {
                      questions: true,
                    },
                  },
                },
              },
              event: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          }),
          // ESTest records (created via TD Portal)
          prisma.eSTest.findMany({
            where: {
              tournamentId: registration.tournamentId,
              status: 'PUBLISHED',
              OR: [
                { eventId: { in: assignedEventIds } },
                { eventId: null }, // Tests not assigned to a specific event
              ],
            },
            select: {
              id: true,
              name: true,
              description: true,
              instructions: true,
              durationMinutes: true,
              startAt: true,
              endAt: true,
              allowLateUntil: true,
              requireFullscreen: true,
              allowCalculator: true,
              calculatorType: true,
              allowNoteSheet: true,
              noteSheetInstructions: true,
              status: true,
              maxAttempts: true,
              scoreReleaseMode: true,
              releaseScoresAt: true,
              scoresReleased: true,
              event: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              questions: {
                select: {
                  id: true,
                },
              },
            },
          }),
        ])

        // Filter to only PUBLISHED tests
        // Note: We show ALL published tests regardless of startAt/endAt times.
        // Time restrictions are enforced when the user attempts to start the test
        // (see isTestAvailable in test-security.ts and the /api/tests/[testId]/attempts/start endpoint)
        const releasedTournamentTests = tournamentTests.filter(
          (tt) => tt.test.status === 'PUBLISHED'
        )

        // Filter to only PUBLISHED ESTests (status is already selected in the query above)
        const releasedESTests = esTests.filter(
          (et) => et.status === 'PUBLISHED'
        )

        let tournamentEnded = false
        const endDate = new Date(registration.tournament.endDate)
        const endTime = new Date(registration.tournament.endTime)
        const tournamentEndDateTime = new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          endTime.getHours(),
          endTime.getMinutes(),
          endTime.getSeconds()
        )
        tournamentEnded = new Date() >= tournamentEndDateTime

        // Fetch user attempts for ESTests to check completion status and count attempts
        const esTestIds = releasedESTests.map(et => et.id)
        let userESTestAttempts: Array<{ testId: string; status: string; submittedAt: Date | null }> = []
        if (esTestIds.length > 0) {
          try {
            userESTestAttempts = await prisma.eSTestAttempt.findMany({
              where: {
                membershipId: membership.id,
                testId: { in: esTestIds },
                status: {
                  in: ['SUBMITTED', 'GRADED'],
                },
              },
              select: {
                testId: true,
                status: true,
                submittedAt: true,
              },
            })
          } catch (error) {
            console.error('Error fetching ESTest attempts:', error)
            // Continue with empty array if this fails
            userESTestAttempts = []
          }
        }

        const userESTestAttemptMap = new Map(
          userESTestAttempts.map(attempt => [attempt.testId, attempt])
        )

        // Count completed attempts per ESTest for maxAttempts checking (single pass)
        const esTestAttemptCounts = userESTestAttempts.reduce((acc, currentAttempt) => {
          acc.set(currentAttempt.testId, (acc.get(currentAttempt.testId) || 0) + 1)
          return acc
        }, new Map<string, number>())

        // Fetch user attempts for regular tests to check completion status and count attempts
        const regularTestIds = releasedTournamentTests.map(tt => tt.test.id)
        let userTestAttempts: Array<{ testId: string; status: string; submittedAt: Date | null }> = []
        if (regularTestIds.length > 0) {
          try {
            userTestAttempts = await prisma.testAttempt.findMany({
              where: {
                membershipId: membership.id,
                testId: { in: regularTestIds },
                status: {
                  in: ['SUBMITTED', 'GRADED'],
                },
              },
              select: {
                testId: true,
                status: true,
                submittedAt: true,
              },
            })
          } catch (error) {
            console.error('Error fetching Test attempts:', error)
            // Continue with empty array if this fails
            userTestAttempts = []
          }
        }

        const userTestAttemptMap = new Map(
          userTestAttempts.map(attempt => [attempt.testId, attempt])
        )

        // Count completed attempts per regular test for maxAttempts checking (single pass)
        const regularTestAttemptCounts = userTestAttempts.reduce((acc, currentAttempt) => {
          acc.set(currentAttempt.testId, (acc.get(currentAttempt.testId) || 0) + 1)
          return acc
        }, new Map<string, number>())

        // Score release metadata is selected directly in releasedESTests.
        const esTestScoresStatusMap = new Map(
          releasedESTests.map((test) => [
            test.id,
            {
              releaseScoresAt: test.releaseScoresAt,
              scoreReleaseMode: test.scoreReleaseMode || 'FULL_TEST',
              scoresReleased: test.scoresReleased === true,
            },
          ])
        )

        // Combine both types of tests into a unified format
        // Map ESTest to the same format as regular Test (ESTest doesn't have all the fields)
        // Filter out tests where user has reached maxAttempts
        const releasedTests = [
          ...releasedTournamentTests
            .map((tt) => {
              // Check if user has reached maxAttempts
              const completedAttempts = regularTestAttemptCounts.get(tt.test.id) || 0
              if (tt.test.maxAttempts !== null && completedAttempts >= tt.test.maxAttempts) {
                return null // Filter out this test
              }

              // Calculate canViewResults for regular tests
              const userAttempt = userTestAttemptMap.get(tt.test.id)
              const hasCompletedAttempt = !!userAttempt
              const now = new Date()
              let scoresReleased = false
              
              // Check if scores are released based on releaseScoresAt
              // If releaseScoresAt is set and has passed (or is now), scores are released
              if (tt.test.releaseScoresAt) {
                const releaseDate = tt.test.releaseScoresAt instanceof Date ? tt.test.releaseScoresAt : new Date(tt.test.releaseScoresAt)
                if (!isNaN(releaseDate.getTime())) {
                  // Allow a small buffer (1 second) to account for timing differences
                  scoresReleased = now.getTime() >= (releaseDate.getTime() - 1000)
                }
              }
              // Note: For regular tests, we don't have a scoresReleased field, so we rely on releaseScoresAt
              
              const canViewResults = hasCompletedAttempt && scoresReleased

              return {
                testId: tt.test.id,
                eventId: tt.eventId,
                isESTest: false,
                test: {
                  isESTest: false,
                  id: tt.test.id,
                  name: tt.test.name,
                  description: tt.test.description,
                  instructions: tt.test.instructions,
                  durationMinutes: tt.test.durationMinutes,
                  startAt: tt.test.startAt ? (typeof tt.test.startAt === 'string' ? tt.test.startAt : tt.test.startAt.toISOString()) : null,
                  endAt: tt.test.endAt ? (typeof tt.test.endAt === 'string' ? tt.test.endAt : tt.test.endAt.toISOString()) : null,
                  allowLateUntil: tt.test.allowLateUntil ? (typeof tt.test.allowLateUntil === 'string' ? tt.test.allowLateUntil : tt.test.allowLateUntil.toISOString()) : null,
                  requireFullscreen: tt.test.requireFullscreen,
                  allowCalculator: tt.test.allowCalculator,
                  calculatorType: tt.test.calculatorType,
                  allowNoteSheet: tt.test.allowNoteSheet,
                  noteSheetInstructions: tt.test.noteSheetInstructions,
                  maxAttempts: tt.test.maxAttempts,
                  scoreReleaseMode: tt.test.scoreReleaseMode,
                  releaseScoresAt: tt.test.releaseScoresAt ? (typeof tt.test.releaseScoresAt === 'string' ? tt.test.releaseScoresAt : tt.test.releaseScoresAt.toISOString()) : null,
                  scoresReleased: scoresReleased, // For regular tests, calculate from releaseScoresAt
                  questionCount: tt.test._count?.questions ?? 0,
                  clubId: tt.test.clubId,
                  club: tt.test.club,
                  tournamentEnded: tournamentEnded, // Add flag to indicate if tournament has ended
                  hasCompletedAttempt: hasCompletedAttempt,
                  canViewResults: canViewResults,
                },
                event: tt.event,
              }
            })
            .filter((test): test is NonNullable<typeof test> => test !== null),
          ...releasedESTests
            .map((et) => {
              // Check if user has reached maxAttempts
              const completedAttempts = esTestAttemptCounts.get(et.id) || 0
              if (et.maxAttempts !== null && completedAttempts >= et.maxAttempts) {
                return null // Filter out this test
              }

              const userAttempt = userESTestAttemptMap.get(et.id)
              const scoresStatus = esTestScoresStatusMap.get(et.id)
              const now = new Date()
              // Safely access new fields that might not exist yet (if migration hasn't run)
              const releaseScoresAt = scoresStatus?.releaseScoresAt
              const scoreReleaseMode = scoresStatus?.scoreReleaseMode || 'FULL_TEST'
              const scoresReleasedField = scoresStatus?.scoresReleased ?? false
              let scoresReleased = false
              // Check if scores are explicitly released (must be exactly true, not just truthy)
              if (scoresReleasedField === true) {
                scoresReleased = true
              } else if (releaseScoresAt) {
                // Check if release date has passed
                const releaseDate = releaseScoresAt instanceof Date ? releaseScoresAt : new Date(releaseScoresAt)
                if (!isNaN(releaseDate.getTime())) {
                  scoresReleased = now >= releaseDate
                }
              }
              const hasCompletedAttempt = !!userAttempt
              const canViewResults = hasCompletedAttempt && scoresReleased

              return {
                testId: et.id,
                eventId: et.event?.id || null,
                isESTest: true,
                test: {
                  isESTest: true,
                  id: et.id,
                  name: et.name,
                  description: et.description,
                  instructions: et.instructions,
                  durationMinutes: et.durationMinutes,
                  startAt: et.startAt ? (typeof et.startAt === 'string' ? et.startAt : et.startAt.toISOString()) : null,
                  endAt: et.endAt ? (typeof et.endAt === 'string' ? et.endAt : et.endAt.toISOString()) : null,
                  allowLateUntil: et.allowLateUntil ? (typeof et.allowLateUntil === 'string' ? et.allowLateUntil : et.allowLateUntil.toISOString()) : null,
                  requireFullscreen: et.requireFullscreen ?? true,
                  allowCalculator: et.allowCalculator ?? false,
                  calculatorType: et.calculatorType ?? null,
                  maxAttempts: et.maxAttempts,
                  allowNoteSheet: et.allowNoteSheet ?? false,
                  noteSheetInstructions: et.noteSheetInstructions ?? null,
                scoreReleaseMode: scoreReleaseMode || 'FULL_TEST',
                releaseScoresAt: releaseScoresAt ? (typeof releaseScoresAt === 'string' ? releaseScoresAt : (releaseScoresAt instanceof Date ? releaseScoresAt.toISOString() : null)) : null,
                scoresReleased: scoresReleased,
                questionCount: et.questions?.length ?? 0,
                clubId: registration.clubId, // Use registration's clubId as fallback
                club: registration.club,
                hasCompletedAttempt: hasCompletedAttempt,
                canViewResults: canViewResults,
                tournamentEnded: tournamentEnded, // Add flag to indicate if tournament has ended
              },
              event: et.event,
            }
            })
            .filter((test): test is NonNullable<typeof test> => test !== null),
        ]

        // Get trial events from tournament
        let trialEvents: Array<{ name: string; division: string }> = []
        if (registration.tournament.trialEvents) {
          try {
            const parsed = JSON.parse(registration.tournament.trialEvents)
            if (Array.isArray(parsed)) {
              // Normalize format: handle both old format (string[]) and new format ({ name, division }[])
              trialEvents = parsed.map((e: string | { name: string; division?: string }) => 
                typeof e === 'string' 
                  ? { name: e, division: registration.tournament.division } 
                  : { name: e.name, division: e.division || registration.tournament.division }
              )
            }
          } catch (e) {
            console.error('Error parsing trial events:', e)
          }
        }
        const trialEventsByName = new Map(
          trialEvents.map((event) => [event.name.toLowerCase(), event])
        )
        const assignedTrialEventNames = new Set(
          memberTrialEventAssignments.map((assignment) => assignment.eventName.toLowerCase())
        )

        // Fetch eventNames from audit logs for tests with null eventId (trial events)
        const testsWithNullEventId = releasedTests.filter(tt => !tt.eventId)
        const testEventNameMap = new Map<string, string>()
        
        if (testsWithNullEventId.length > 0) {
          const estestIds = testsWithNullEventId.filter(tt => tt.isESTest).map(tt => tt.test.id)
          const regularTestIds = testsWithNullEventId.filter(tt => !tt.isESTest).map(tt => tt.test.id)

          // Fetch ESTestAudit for ESTest records
          if (estestIds.length > 0) {
            const esCreateAudits = await prisma.eSTestAudit.findMany({
              where: {
                testId: { in: estestIds },
                action: 'CREATE',
              },
              select: {
                testId: true,
                details: true,
              },
            })
            for (const audit of esCreateAudits) {
              if (audit.testId && audit.details && typeof audit.details === 'object' && 'eventName' in audit.details) {
                const eventName = (audit.details as Record<string, unknown>).eventName
                if (eventName && typeof eventName === 'string') {
                  testEventNameMap.set(audit.testId, eventName)
                }
              }
            }
          }

          // Fetch TestAudit for regular Test records
          if (regularTestIds.length > 0) {
            const testCreateAudits = await prisma.testAudit.findMany({
              where: {
                testId: { in: regularTestIds },
                action: 'CREATE',
              },
              select: {
                testId: true,
                details: true,
              },
            })
            for (const audit of testCreateAudits) {
              if (audit.testId && audit.details && typeof audit.details === 'object' && 'eventName' in audit.details) {
                const eventName = (audit.details as Record<string, unknown>).eventName
                if (eventName && typeof eventName === 'string') {
                  testEventNameMap.set(audit.testId, eventName)
                }
              }
            }
          }
        }

        const serializeReleasedTest = (releasedTest: (typeof releasedTests)[number]) => ({
          id: releasedTest.test.id,
          name: releasedTest.test.name,
          description: releasedTest.test.description,
          instructions: releasedTest.test.instructions,
          durationMinutes: releasedTest.test.durationMinutes,
          startAt: releasedTest.test.startAt,
          endAt: releasedTest.test.endAt,
          allowLateUntil: releasedTest.test.allowLateUntil,
          requireFullscreen: releasedTest.test.requireFullscreen,
          allowCalculator: releasedTest.test.allowCalculator,
          calculatorType: releasedTest.test.calculatorType,
          allowNoteSheet: releasedTest.test.allowNoteSheet,
          noteSheetInstructions: releasedTest.test.noteSheetInstructions,
          maxAttempts: releasedTest.test.maxAttempts,
          scoreReleaseMode: releasedTest.test.scoreReleaseMode,
          releaseScoresAt: releasedTest.test.releaseScoresAt,
          scoresReleased: releasedTest.test.scoresReleased,
          questionCount: releasedTest.test.questionCount,
          clubId: releasedTest.test.clubId,
          club: releasedTest.test.club,
          isESTest: releasedTest.isESTest,
          hasCompletedAttempt: releasedTest.test.hasCompletedAttempt,
          canViewResults: releasedTest.test.canViewResults,
          tournamentEnded: releasedTest.test.tournamentEnded || tournamentEnded,
        })

        const testsByEventId = releasedTests.reduce((acc, releasedTest) => {
          if (!releasedTest.eventId) return acc
          const existing = acc.get(releasedTest.eventId)
          if (existing) {
            existing.push(releasedTest)
          } else {
            acc.set(releasedTest.eventId, [releasedTest])
          }
          return acc
        }, new Map<string, Array<(typeof releasedTests)[number]>>())

        // Group tests by event using tournament-specific member assignments.
        let eventsWithTests: Array<{ event: Record<string, unknown>; tests: Array<Record<string, unknown>> }> = []

        const uniqueAssignedEvents = Array.from(
          new Map(memberEventAssignments.map((assignment) => [assignment.event.id, assignment.event])).values()
        )

        eventsWithTests = uniqueAssignedEvents.map((event) => ({
          event,
          tests: (testsByEventId.get(event.id) || []).map(serializeReleasedTest),
        }))

        // Separate tests with null eventId into trial events and true general tests
        const testsWithNullEventId_ = releasedTests.filter((tt) => !tt.eventId)
        
        // Group trial event tests by event name and filter to assigned trial events only.
        const trialEventNameSet = new Set(Array.from(trialEventsByName.keys()))
        const trialEventTestsByEvent = new Map<string, Array<Record<string, unknown>>>()
        const generalTests: Array<Record<string, unknown>> = []

        for (const tt of testsWithNullEventId_) {
          const rawEventName = testEventNameMap.get(tt.test.id)
          const normalizedEventName = rawEventName?.toLowerCase() ?? null
          if (normalizedEventName && trialEventNameSet.has(normalizedEventName)) {
            // Trial event tests are visible only if this member is assigned to that trial event.
            if (!assignedTrialEventNames.has(normalizedEventName)) {
              continue
            }

            if (!trialEventTestsByEvent.has(normalizedEventName)) {
              trialEventTestsByEvent.set(normalizedEventName, [])
            }
            trialEventTestsByEvent.get(normalizedEventName)!.push(serializeReleasedTest(tt))
          } else {
            // True general test (not a trial event)
            generalTests.push(serializeReleasedTest(tt))
          }
        }

        // Convert trial event tests map to array format
        const trialEventsWithTests = Array.from(trialEventTestsByEvent.entries()).map(([normalizedName, tests]) => {
          const trialEvent = trialEventsByName.get(normalizedName)
          const eventName = trialEvent?.name ?? normalizedName
          return {
            event: {
              id: null, // Trial events don't have an Event ID
              name: eventName,
              slug: null,
              division: trialEvent?.division || registration.tournament.division,
              isTrial: true,
            },
            tests,
          }
        })

        return {
          tournament: registration.tournament,
          registration: {
            id: registration.id,
            team: registration.team,
            club: registration.club,
          },
          events: eventsWithTests,
          trialEvents: trialEventsWithTests, // Trial event tests grouped by event
          generalTests, // True general tests (not assigned to any event, including trial events)
        }
      })
    )

    // Filter out null values
    const validTournaments = tournamentsWithData.filter(
      (t): t is NonNullable<typeof t> => t !== null
    )

    return NextResponse.json({ tournaments: validTournaments })
  } catch (error) {
    console.error('Get testing tournaments error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

