import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTestAvailable } from '@/lib/test-security'
import { TakeTestClient } from '@/components/tests/take-test-client'

export default async function TournamentTakeTestPage({
  params,
}: {
  params: Promise<{ testId: string }> | { testId: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Resolve params if it's a Promise (Next.js 15 compatibility)
  const resolvedParams = params instanceof Promise ? await params : params
  const testId = resolvedParams.testId

  // Try to find the test - could be a regular Test or ESTest
  // First, check if it's a regular Test linked to a tournament via TournamentTest
  // We query TournamentTest first since that's how tests are linked to tournaments
  let tournamentTest = await prisma.tournamentTest.findFirst({
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
          testPasswordHash: true,
          maxAttempts: true,
          scoreReleaseMode: true,
          clubId: true,
          questions: {
            orderBy: { order: 'asc' },
            include: {
              options: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      },
    },
  })

  // If not found via TournamentTest, try finding the Test directly and then check if it has a TournamentTest link
  if (!tournamentTest) {
    const directTest = await prisma.test.findUnique({
      where: { id: testId },
      select: { id: true },
    })
    
    if (directTest) {
      // Test exists, try to find TournamentTest link again (maybe there was a race condition)
      tournamentTest = await prisma.tournamentTest.findFirst({
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
              testPasswordHash: true,
              maxAttempts: true,
              scoreReleaseMode: true,
              clubId: true,
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  options: {
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          },
        },
      })
    }
  }

  let test: any = null
  let tournamentId: string | null = null
  let eventId: string | null = null
  let isESTest = false

  if (tournamentTest && tournamentTest.test) {
    // Regular Test linked via TournamentTest
    test = tournamentTest.test
    tournamentId = tournamentTest.tournament.id
    eventId = tournamentTest.eventId
    } else {
      // Check if it's an ESTest
      const esTest = await prisma.eSTest.findUnique({
        where: {
          id: testId,
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
          questions: {
            orderBy: { order: 'asc' },
            include: {
              options: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      })

      if (esTest) {
      // Convert ESTest to Test-like format for TakeTestClient
      test = {
        id: esTest.id,
        name: esTest.name,
        description: esTest.description,
        instructions: esTest.instructions || null,
        status: esTest.status,
        durationMinutes: esTest.durationMinutes,
        startAt: esTest.startAt,
        endAt: esTest.endAt,
        allowLateUntil: esTest.allowLateUntil,
        requireFullscreen: false, // ESTest doesn't have this
        allowCalculator: false, // ESTest doesn't have this
        calculatorType: null,
        allowNoteSheet: false, // ESTest doesn't have this
        noteSheetInstructions: null,
        testPasswordHash: null, // ESTest doesn't have password
        maxAttempts: null, // ESTest doesn't have max attempts
        scoreReleaseMode: 'FULL_TEST', // Default for ESTest
        clubId: null, // ESTest doesn't belong to a club
        questions: esTest.questions.map((q) => ({
          id: q.id,
          type: q.type,
          promptMd: q.promptMd,
          explanation: q.explanation,
          points: Number(q.points),
          shuffleOptions: q.shuffleOptions,
          order: q.order,
          numericTolerance: q.numericTolerance ? Number(q.numericTolerance) : null,
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            isCorrect: o.isCorrect,
            order: o.order,
          })),
        })),
      }
      tournamentId = esTest.tournament.id
      eventId = esTest.eventId
      isESTest = true
    } else {
      // Test not found as TournamentTest or ESTest
      notFound()
    }
  }

  if (!test || !tournamentId) {
    notFound()
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
      tournamentId: tournamentId!,
      status: 'CONFIRMED',
      OR: [
        { teamId: { in: teamIds } },
        { clubId: { in: clubIds } },
      ],
    },
    include: {
      team: {
        select: {
          id: true,
        },
      },
      club: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!registration) {
    // User is not registered for this tournament
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You are not registered for this tournament.
          </p>
          <a
            href="/testing"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to Testing Portal
          </a>
        </div>
      </div>
    )
  }

  // Find the membership that matches this registration
  const membership = registration.teamId
    ? userMemberships.find(
        (m) => m.clubId === registration.clubId && m.teamId === registration.teamId
      )
    : userMemberships.find((m) => m.clubId === registration.clubId)

  if (!membership) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            Membership not found.
          </p>
          <a
            href="/testing"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to Testing Portal
          </a>
        </div>
      </div>
    )
  }

  // Check if test is published
  if (test.status !== 'PUBLISHED') {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h1 className="text-2xl font-bold text-destructive mb-2">Test Not Available</h1>
          <p className="text-muted-foreground mb-4">
            This test is not published yet.
          </p>
          <a
            href="/testing"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to Testing Portal
          </a>
        </div>
      </div>
    )
  }

  // Check if test is available (scheduling)
  const availability = isTestAvailable(test)
  if (!availability.available) {
    // Return error page instead of redirecting
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h1 className="text-2xl font-bold text-destructive mb-2">Test Not Available</h1>
          <p className="text-muted-foreground mb-4">
            {availability.reason || 'This test is not currently available.'}
          </p>
          <a
            href="/testing"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to Testing Portal
          </a>
        </div>
      </div>
    )
  }

  // For tournament tests, check if user is assigned to the event (if test is event-specific)
  let hasAccess = false
  if (eventId) {
    const userEventAssignments = await prisma.rosterAssignment.findMany({
      where: {
        membershipId: membership.id,
        eventId: eventId,
        ...(registration.teamId
          ? { teamId: registration.teamId }
          : {
              team: {
                clubId: registration.clubId,
              },
            }),
      },
    })

    hasAccess = userEventAssignments.length > 0
  } else {
    // General tournament test (not event-specific) - all registered users can access
    hasAccess = true
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You are not assigned to this event.
          </p>
          <a
            href="/testing"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to Testing Portal
          </a>
        </div>
      </div>
    )
  }

  // Check for existing in-progress or not-started attempt
  let existingAttempt = null
  if (isESTest) {
    existingAttempt = await prisma.eSTestAttempt.findFirst({
      where: {
        membershipId: membership.id,
        testId: test.id,
        status: {
          in: ['NOT_STARTED', 'IN_PROGRESS'],
        },
      },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: { orderBy: { order: 'asc' } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    existingAttempt = await prisma.testAttempt.findFirst({
      where: {
        membershipId: membership.id,
        testId: test.id,
        status: {
          in: ['NOT_STARTED', 'IN_PROGRESS'],
        },
      },
      include: {
        answers: {
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // Ensure test has all required fields
  if (!test || !test.id || !membership) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
          <p className="text-muted-foreground mb-4">
            Test or membership information is missing.
          </p>
          <a
            href="/testing"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to Testing Portal
          </a>
        </div>
      </div>
    )
  }

  return (
    <TakeTestClient
      test={test}
      membership={membership}
      existingAttempt={existingAttempt}
      isAdmin={false} // Tournament tests don't have admin bypass
    />
  )
}

