import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { isTestAvailable } from '@/lib/test-security'
import { TakeTestClient } from '@/components/tests/take-test-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export default async function TakeTestPage({
  params,
}: {
  params: Promise<{ clubId: string; testId: string }>
}) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const test = await prisma.test.findFirst({
    where: {
      id: resolvedParams.testId,
      clubId: resolvedParams.clubId,
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
      testPasswordHash: true,
      maxAttempts: true,
      scoreReleaseMode: true,
      assignments: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
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

  if (!test) {
    notFound()
  }

  // Check if this is a tournament test
  const tournamentTest = await prisma.tournamentTest.findFirst({
    where: {
      testId: test.id,
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
    },
  })

  let membership: any
  let isAdminUser = false
  let hasAccess = false

  if (tournamentTest) {
    // This is a tournament test - check tournament registration instead of club membership
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
      redirect('/testing')
    }

    // Find the membership that matches this registration
    membership = registration.teamId
      ? userMemberships.find(
          (m) => m.clubId === registration.clubId && m.teamId === registration.teamId
        )
      : userMemberships.find((m) => m.clubId === registration.clubId)

    if (!membership) {
      redirect('/testing')
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

      hasAccess = userEventAssignments.length > 0
    } else {
      // General tournament test (not event-specific) - all registered users can access
      hasAccess = true
    }

    if (!hasAccess) {
      redirect('/testing')
    }
  } else {
    // Regular club test - use existing logic
    membership = await getUserMembership(session.user.id, resolvedParams.clubId)
    if (!membership) {
      redirect('/no-clubs')
    }

    isAdminUser = await isAdmin(session.user.id, resolvedParams.clubId)

    // Admins can take any test, but members need proper access
    if (!isAdminUser) {
      // Check if test is published
      if (test.status !== 'PUBLISHED') {
        redirect(`/club/${resolvedParams.clubId}?tab=tests`)
      }

      // Check if test is available (scheduling)
      const availability = isTestAvailable(test)
      if (!availability.available) {
        redirect(`/club/${resolvedParams.clubId}?tab=tests`)
      }

      // Get user's event assignments from roster for event-based test access
      const userEventAssignments = await prisma.rosterAssignment.findMany({
        where: {
          membershipId: membership.id,
          team: { clubId: resolvedParams.clubId },
        },
        select: { eventId: true },
      })
      const userEventIds = userEventAssignments.map(ra => ra.eventId)

      // Check assignment - must match logic in API routes
      // If test has no assignments, user cannot access it
      if (test.assignments.length === 0) {
        redirect(`/club/${resolvedParams.clubId}?tab=tests`)
      }

      hasAccess = test.assignments.some(
        (a) =>
          // CLUB scope - everyone in the club gets access
          a.assignedScope === 'CLUB' ||
          // Team-based - user's primary team matches assignment's team
          (a.teamId && membership.teamId && a.teamId === membership.teamId) ||
          // PERSONAL scope - directly assigned to this user
          a.targetMembershipId === membership.id ||
          // Event-based assignments - user must have the event in their roster
          (a.eventId && userEventIds.includes(a.eventId))
      )

      if (!hasAccess) {
        redirect(`/club/${resolvedParams.clubId}?tab=tests`)
      }
    } else {
      hasAccess = true
    }
  }

  // Check for existing in-progress or not-started attempt
  const existingAttempt = await prisma.testAttempt.findFirst({
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

  // Check maxAttempts limit if no in-progress attempt exists
  // This prevents users (including admins) from starting a new attempt after they've already reached the limit
  if (!existingAttempt && test.maxAttempts !== null) {
    const completedAttempts = await prisma.testAttempt.count({
      where: {
        membershipId: membership.id,
        testId: test.id,
        status: {
          in: ['SUBMITTED', 'GRADED'],
        },
      },
    })

    if (completedAttempts >= test.maxAttempts) {
      const redirectPath = tournamentTest 
        ? '/testing' 
        : `/club/${resolvedParams.clubId}?tab=tests`
      
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
                  <a href={redirectPath}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {tournamentTest ? 'Return to Testing Portal' : 'Return to Tests'}
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
  }

  return (
    <TakeTestClient
      test={test}
      membership={membership}
      existingAttempt={existingAttempt}
      isAdmin={isAdminUser}
      tournamentId={tournamentTest?.tournament.id}
    />
  )
}


