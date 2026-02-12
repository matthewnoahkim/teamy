import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/testing/tournaments
// Get all tournaments the user's teams are registered for, with their assigned events and released tests
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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

    // Deduplicate tournaments by tournament ID
    const uniqueRegistrations = registrations.reduce((acc, reg) => {
      if (!acc.find((r) => r.tournament.id === reg.tournament.id)) {
        acc.push(reg)
      }
      return acc
    }, [] as typeof registrations)

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

        // Get events the user is assigned to on this team/club
        // If registration has a specific team, get assignments for that team
        // Otherwise, get all assignments for the user in this club
        const rosterAssignments = await prisma.rosterAssignment.findMany({
          where: {
            membershipId: membership.id,
            ...(registration.teamId
              ? { teamId: registration.teamId }
              : {
                  team: {
                    clubId: registration.clubId,
                  },
                }),
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
        })

        const eventIds = rosterAssignments.map((ra) => ra.event.id)

        // Get released tests for these events in this tournament
        // Include both regular Test records (via TournamentTest) and ESTest records
        // IMPORTANT: If user has no event assignments, show all tests (eventId: null OR any eventId)
        // This allows tests to be visible even if roster hasn't been set up yet
        const [tournamentTests, esTests] = await Promise.all([
          // Regular Test records linked via TournamentTest
          prisma.tournamentTest.findMany({
            where: {
              tournamentId: registration.tournamentId,
              OR: eventIds.length === 0
                ? [
                    // If no event assignments, show all tests (both event-specific and general)
                    {},
                  ]
                : [
                    { eventId: { in: eventIds } },
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
              OR: eventIds.length === 0
                ? [
                    // If no event assignments, show all tests (both event-specific and general)
                    {},
                  ]
                : [
                    { eventId: { in: eventIds } },
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

        // Check if tournament has ended - we'll use this to determine if tests can be taken
        const tournament = await prisma.tournament.findUnique({
          where: { id: registration.tournamentId },
          select: { endDate: true, endTime: true },
        })

        let tournamentEnded = false
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
          tournamentEnded = new Date() >= tournamentEndDateTime
        }

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

        // Count completed attempts per ESTest for maxAttempts checking
        const esTestAttemptCounts = new Map<string, number>()
        for (const testId of esTestIds) {
          const count = userESTestAttempts.filter(a => a.testId === testId).length
          esTestAttemptCounts.set(testId, count)
        }

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

        // Count completed attempts per regular test for maxAttempts checking
        const regularTestAttemptCounts = new Map<string, number>()
        for (const testId of regularTestIds) {
          const count = userTestAttempts.filter(a => a.testId === testId).length
          regularTestAttemptCounts.set(testId, count)
        }

        // Fetch scoresReleased status for all ESTests
        // Query separately to get score release fields
        let esTestScoresStatusMap = new Map<string, { releaseScoresAt: Date | string | null; scoreReleaseMode: string; scoresReleased: boolean }>()
        if (esTestIds.length > 0) {
          console.log(`[API Testing Tournaments] Fetching scoresReleased for ${esTestIds.length} tests:`, esTestIds)
          try {
            const esTestScoresStatus = await prisma.eSTest.findMany({
              where: {
                id: { in: esTestIds },
              },
              select: {
                id: true,
                releaseScoresAt: true,
                scoreReleaseMode: true,
                scoresReleased: true,
              },
            })
            console.log(`[API Testing Tournaments] Fetched ${esTestScoresStatus.length} test score statuses:`, esTestScoresStatus.map(t => ({ id: t.id, scoresReleased: t.scoresReleased })))
            esTestScoresStatusMap = new Map(
              esTestScoresStatus.map(t => {
                // Handle scoresReleased - Prisma returns boolean, ensure we check for true explicitly
                // The field is Boolean @default(false), so it should be true/false, not null
                // IMPORTANT: Check the raw value from Prisma - it should be boolean true/false
                const rawScoresReleased = t.scoresReleased
                const scoresReleased = rawScoresReleased === true
                
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[API Testing Tournaments] Test ${t.id}:`, {
                    rawScoresReleased,
                    type: typeof rawScoresReleased,
                    isTrue: rawScoresReleased === true,
                    isTruthy: !!rawScoresReleased,
                    processed: scoresReleased,
                  })
                }
                
                return [t.id, {
                  releaseScoresAt: t.releaseScoresAt,
                  scoreReleaseMode: t.scoreReleaseMode || 'FULL_TEST',
                  scoresReleased: scoresReleased,
                }]
              })
            )
          } catch (error: unknown) {
            console.error(`[API Testing Tournaments] Error fetching scoresReleased:`, error)
            // If fields don't exist (migration not run), try without scoresReleased
            const errMsg = error instanceof Error ? error.message : ''
            const errCode = (error as Record<string, unknown>)?.code
            if (errMsg.includes('does not exist') || errCode === 'P2025') {
              console.warn(`[API Testing Tournaments] scoresReleased column doesn't exist, trying without it`)
              try {
                const esTestScoresStatus = await prisma.eSTest.findMany({
                  where: {
                    id: { in: esTestIds },
                  },
                  select: {
                    id: true,
                    releaseScoresAt: true,
                    scoreReleaseMode: true,
                  },
                })
                esTestScoresStatusMap = new Map(
                  esTestScoresStatus.map(t => [t.id, {
                    releaseScoresAt: t.releaseScoresAt,
                    scoreReleaseMode: t.scoreReleaseMode || 'FULL_TEST',
                    scoresReleased: false,
                  }])
                )
                console.log(`[API Testing Tournaments] Fallback: Set scoresReleased=false for ${esTestScoresStatus.length} tests`)
              } catch (e) {
                console.error('[API Testing Tournaments] Error in fallback query:', e)
              }
            } else {
              console.error('[API Testing Tournaments] Error fetching score release status:', error)
              throw error
            }
          }
        } else {
          console.log(`[API Testing Tournaments] No ESTest IDs to fetch scoresReleased for`)
        }

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
              
              if (process.env.NODE_ENV === 'development') {
                console.log(`[API Testing Tournaments] Regular test ${tt.test.id}: hasCompletedAttempt=${hasCompletedAttempt}, releaseScoresAt=${tt.test.releaseScoresAt}, scoresReleased=${scoresReleased}, canViewResults=${canViewResults}`)
              }
              
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
              // Get scoresReleased - if not in map, try to fetch it directly as fallback
              let scoresReleasedField = scoresStatus?.scoresReleased
              if (scoresReleasedField === undefined && esTestIds.includes(et.id)) {
                // Fallback: if not in map, it might be because the query failed, try direct lookup
                // This shouldn't happen, but handle it gracefully
                console.warn(`Test ${et.id} not found in scoresStatusMap, using default false`)
                scoresReleasedField = false
              }
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
              
              // Debug logging
              if (process.env.NODE_ENV === 'development') {
                console.log(`[API] Test ${et.id}: scoresStatus=`, scoresStatus, 'scoresReleasedField=', scoresReleasedField, 'scoresReleased=', scoresReleased, 'hasCompletedAttempt=', hasCompletedAttempt, 'canViewResults=', canViewResults)
              }

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
        const trialEventNames = trialEvents.map(e => e.name)

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

        // Group tests by event
        // If user has no roster assignments, show all event-specific tests grouped by their events
        let eventsWithTests: Array<{ event: Record<string, unknown>; tests: Array<Record<string, unknown>> }> = []
        
        if (eventIds.length === 0) {
          // No roster assignments - show all event-specific tests grouped by event
          const allEventIds = [...new Set(releasedTests.map(tt => tt.eventId).filter((id): id is string => id !== null))]
          
          if (allEventIds.length > 0) {
            // Get event details for all events that have tests
            const eventsWithTestData = await prisma.event.findMany({
              where: {
                id: { in: allEventIds },
                division: registration.tournament.division,
              },
              select: {
                id: true,
                name: true,
                slug: true,
                division: true,
              },
            })
            
            eventsWithTests = eventsWithTestData.map((event) => {
              const eventTests = releasedTests.filter(
                (tt) => tt.eventId === event.id
              )
              return {
                event: {
                  id: event.id,
                  name: event.name,
                  slug: event.slug,
                  division: event.division,
                },
                tests: eventTests.map((tt) => ({
                  id: tt.test.id,
                  name: tt.test.name,
                  description: tt.test.description,
                  instructions: tt.test.instructions,
                  durationMinutes: tt.test.durationMinutes,
                  startAt: tt.test.startAt,
                  endAt: tt.test.endAt,
                  allowLateUntil: tt.test.allowLateUntil,
                  requireFullscreen: tt.test.requireFullscreen,
                  allowCalculator: tt.test.allowCalculator,
                  calculatorType: tt.test.calculatorType,
                  allowNoteSheet: tt.test.allowNoteSheet,
                  noteSheetInstructions: tt.test.noteSheetInstructions,
                  maxAttempts: tt.test.maxAttempts,
                  scoreReleaseMode: tt.test.scoreReleaseMode,
                  releaseScoresAt: tt.test.releaseScoresAt,
                  scoresReleased: tt.test.scoresReleased,
                  questionCount: tt.test.questionCount,
                  clubId: tt.test.clubId,
                  club: tt.test.club,
                  isESTest: tt.isESTest,
                  hasCompletedAttempt: tt.test.hasCompletedAttempt,
                  canViewResults: tt.test.canViewResults,
                  tournamentEnded: tt.test.tournamentEnded || tournamentEnded,
                })),
              }
            })
          }
        } else {
          // User has roster assignments - only show tests for assigned events
          eventsWithTests = rosterAssignments.map((ra) => {
            const eventTests = releasedTests.filter(
              (tt) => tt.eventId === ra.event.id
            )
            return {
              event: ra.event,
              tests: eventTests.map((tt) => ({
                id: tt.test.id,
                name: tt.test.name,
                description: tt.test.description,
                instructions: tt.test.instructions,
                durationMinutes: tt.test.durationMinutes,
                startAt: tt.test.startAt,
                endAt: tt.test.endAt,
                allowLateUntil: tt.test.allowLateUntil,
                requireFullscreen: tt.test.requireFullscreen,
                allowCalculator: tt.test.allowCalculator,
                calculatorType: tt.test.calculatorType,
                allowNoteSheet: tt.test.allowNoteSheet,
                noteSheetInstructions: tt.test.noteSheetInstructions,
                maxAttempts: tt.test.maxAttempts,
                scoreReleaseMode: tt.test.scoreReleaseMode,
                releaseScoresAt: tt.test.releaseScoresAt,
                scoresReleased: tt.test.scoresReleased,
                questionCount: tt.test.questionCount,
                clubId: tt.test.clubId,
                club: tt.test.club,
                isESTest: tt.isESTest,
                hasCompletedAttempt: tt.test.hasCompletedAttempt,
                canViewResults: tt.test.canViewResults,
                tournamentEnded: tt.test.tournamentEnded || tournamentEnded,
              })),
            }
          })
        }

        // Separate tests with null eventId into trial events and true general tests
        const testsWithNullEventId_ = releasedTests.filter((tt) => !tt.eventId)
        
        // Group trial event tests by event name
        const trialEventTestsByEvent = new Map<string, Array<Record<string, unknown>>>()
        const generalTests: Array<Record<string, unknown>> = []

        for (const tt of testsWithNullEventId_) {
          const eventName = testEventNameMap.get(tt.test.id)
          if (eventName && trialEventNames.includes(eventName)) {
            // This is a trial event test
            if (!trialEventTestsByEvent.has(eventName)) {
              trialEventTestsByEvent.set(eventName, [])
            }
            trialEventTestsByEvent.get(eventName)!.push({
              id: tt.test.id,
              name: tt.test.name,
              description: tt.test.description,
              instructions: tt.test.instructions,
              durationMinutes: tt.test.durationMinutes,
              startAt: tt.test.startAt,
              endAt: tt.test.endAt,
              allowLateUntil: tt.test.allowLateUntil,
              requireFullscreen: tt.test.requireFullscreen,
              allowCalculator: tt.test.allowCalculator,
              calculatorType: tt.test.calculatorType,
              allowNoteSheet: tt.test.allowNoteSheet,
              noteSheetInstructions: tt.test.noteSheetInstructions,
              maxAttempts: tt.test.maxAttempts,
              scoreReleaseMode: tt.test.scoreReleaseMode,
              releaseScoresAt: tt.test.releaseScoresAt,
              scoresReleased: tt.test.scoresReleased,
              questionCount: tt.test.questionCount,
              clubId: tt.test.clubId,
              club: tt.test.club,
              isESTest: tt.isESTest,
              hasCompletedAttempt: tt.test.hasCompletedAttempt,
              canViewResults: tt.test.canViewResults,
              tournamentEnded: tt.test.tournamentEnded || tournamentEnded,
            })
          } else {
            // True general test (not a trial event)
            generalTests.push({
              id: tt.test.id,
              name: tt.test.name,
              description: tt.test.description,
              instructions: tt.test.instructions,
              durationMinutes: tt.test.durationMinutes,
              startAt: tt.test.startAt,
              endAt: tt.test.endAt,
              allowLateUntil: tt.test.allowLateUntil,
              requireFullscreen: tt.test.requireFullscreen,
              allowCalculator: tt.test.allowCalculator,
              calculatorType: tt.test.calculatorType,
              allowNoteSheet: tt.test.allowNoteSheet,
              noteSheetInstructions: tt.test.noteSheetInstructions,
              maxAttempts: tt.test.maxAttempts,
              scoreReleaseMode: tt.test.scoreReleaseMode,
              releaseScoresAt: tt.test.releaseScoresAt,
              scoresReleased: tt.test.scoresReleased,
              questionCount: tt.test.questionCount,
              clubId: tt.test.clubId,
              club: tt.test.club,
              isESTest: tt.isESTest,
              hasCompletedAttempt: tt.test.hasCompletedAttempt,
              canViewResults: tt.test.canViewResults,
              tournamentEnded: tt.test.tournamentEnded || tournamentEnded,
            })
          }
        }

        // Convert trial event tests map to array format
        const trialEventsWithTests = Array.from(trialEventTestsByEvent.entries()).map(([eventName, tests]) => {
          const trialEvent = trialEvents.find(te => te.name === eventName)
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

