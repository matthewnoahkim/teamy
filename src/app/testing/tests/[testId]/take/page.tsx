import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isTestAvailable } from '@/lib/test-security'
import { TakeTestClient } from '@/components/tests/take-test-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export default async function TournamentTakeTestPage({
  params,
}: {
  params: Promise<{ testId: string }>
}) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Resolve params if it's a Promise (Next.js 15 compatibility)
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
          requireOneSitting: true,
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
              requireOneSitting: true,
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
          requireOneSitting: true,
          maxAttempts: true,
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
          return (
            <div className="container mx-auto max-w-4xl px-4 py-8">
              <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
                <h1 className="text-2xl font-bold text-destructive mb-2">Tournament Has Ended</h1>
                <p className="text-muted-foreground mb-4">
                  This tournament has ended. Test access is no longer available.
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
      }
      
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
        requireFullscreen: esTest.requireFullscreen !== undefined ? esTest.requireFullscreen : true,
        allowCalculator: esTest.allowCalculator ?? false,
        calculatorType: esTest.calculatorType,
        allowNoteSheet: esTest.allowNoteSheet ?? false,
        noteSheetInstructions: esTest.noteSheetInstructions,
        requireOneSitting: esTest.requireOneSitting ?? true,
        testPasswordHash: null, // ESTest doesn't have password
        maxAttempts: esTest.maxAttempts,
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
      eventId = esTest.event?.id || null
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
      <div className="min-h-screen flex items-center justify-center p-4 grid-pattern bg-background">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-destructive bg-destructive/10 dark:bg-background p-6">
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
      <div className="min-h-screen flex items-center justify-center p-4 grid-pattern bg-background">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-destructive bg-destructive/10 dark:bg-background p-6">
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
      </div>
    )
  }

  // Check if test is published
  if (test.status !== 'PUBLISHED') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 grid-pattern bg-background">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-destructive bg-destructive/10 dark:bg-background p-6">
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
      </div>
    )
  }

  // Check if test is available (scheduling)
  const availability = isTestAvailable(test)
  if (!availability.available) {
    // Return error page instead of redirecting
    return (
      <div className="min-h-screen flex items-center justify-center p-4 grid-pattern bg-background">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-destructive bg-destructive/10 dark:bg-background p-6">
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

  // Check maxAttempts limit if no in-progress attempt exists
  // This prevents users from starting a new attempt after they've already reached the limit
  if (!existingAttempt && test.maxAttempts !== null) {
    const completedAttempts = isESTest
      ? await prisma.eSTestAttempt.count({
          where: {
            membershipId: membership.id,
            testId: test.id,
            status: {
              in: ['SUBMITTED', 'GRADED'],
            },
          },
        })
      : await prisma.testAttempt.count({
          where: {
            membershipId: membership.id,
            testId: test.id,
            status: {
              in: ['SUBMITTED', 'GRADED'],
            },
          },
        })

    if (completedAttempts >= test.maxAttempts) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12 grid-pattern">
          <div className="container mx-auto max-w-2xl">
            <Card className="border-destructive/50">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl">Maximum Attempts Reached</CardTitle>
                <CardDescription className="text-base mt-2">
                  You have reached the maximum number of attempts ({test.maxAttempts}) for this test.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pt-2">
                <Button asChild variant="default" size="lg">
                  <a href="/testing">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Return to Testing Portal
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
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
      tournamentId={tournamentId}
      testingPortal={true}
    />
  )
}

