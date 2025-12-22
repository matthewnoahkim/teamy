import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/testing/tournaments
// Get all tournaments the user's teams are registered for, with their assigned events and released tests
export async function GET(req: NextRequest) {
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

        const releasedESTests = esTests.filter(
          (et) => et.status === 'PUBLISHED'
        )

        // Combine both types of tests into a unified format
        // Map ESTest to the same format as regular Test (ESTest doesn't have all the fields)
        const releasedTests = [
          ...releasedTournamentTests.map((tt) => ({
            testId: tt.test.id,
            eventId: tt.eventId,
            isESTest: false,
            test: {
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
              questionCount: tt.test._count?.questions ?? 0,
              clubId: tt.test.clubId,
              club: tt.test.club,
            },
            event: tt.event,
          })),
          ...releasedESTests.map((et) => ({
            testId: et.id,
            eventId: et.eventId,
            isESTest: true,
            test: {
              id: et.id,
              name: et.name,
              description: et.description,
              instructions: null, // ESTest doesn't have this field
              durationMinutes: et.durationMinutes,
              startAt: et.startAt ? (typeof et.startAt === 'string' ? et.startAt : et.startAt.toISOString()) : null,
              endAt: et.endAt ? (typeof et.endAt === 'string' ? et.endAt : et.endAt.toISOString()) : null,
              allowLateUntil: et.allowLateUntil ? (typeof et.allowLateUntil === 'string' ? et.allowLateUntil : et.allowLateUntil.toISOString()) : null,
              requireFullscreen: false, // ESTest doesn't have this field
              allowCalculator: et.allowCalculator ?? false,
              calculatorType: et.calculatorType ?? null,
              allowNoteSheet: et.allowNoteSheet ?? false,
              noteSheetInstructions: et.noteSheetInstructions ?? null,
              maxAttempts: null, // ESTest doesn't have this field
              scoreReleaseMode: null, // ESTest doesn't have this field
              releaseScoresAt: null, // ESTest doesn't have this field
              questionCount: et.questions?.length ?? 0,
              clubId: registration.clubId, // Use registration's clubId as fallback
              club: registration.club,
            },
            event: et.event,
          })),
        ]

        // Group tests by event
        // If user has no roster assignments, show all event-specific tests grouped by their events
        let eventsWithTests: Array<{ event: any; tests: any[] }> = []
        
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
                  questionCount: tt.test.questionCount,
                  clubId: tt.test.clubId,
                  club: tt.test.club,
                  isESTest: tt.isESTest,
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
                questionCount: tt.test.questionCount,
                clubId: tt.test.clubId,
                club: tt.test.club,
                isESTest: tt.isESTest,
              })),
            }
          })
        }

        // Also include tests not assigned to a specific event
        const generalTests = releasedTests
          .filter((tt) => !tt.eventId)
          .map((tt) => ({
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
            questionCount: tt.test.questionCount,
            clubId: tt.test.clubId,
            club: tt.test.club,
            isESTest: tt.isESTest,
          }))

        return {
          tournament: registration.tournament,
          registration: {
            id: registration.id,
            team: registration.team,
            club: registration.club,
          },
          events: eventsWithTests,
          generalTests, // Tests not assigned to a specific event
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

