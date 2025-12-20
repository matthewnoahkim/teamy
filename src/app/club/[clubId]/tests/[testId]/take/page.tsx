import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { isTestAvailable } from '@/lib/test-security'
import { TakeTestClient } from '@/components/tests/take-test-client'

export default async function TakeTestPage({
  params,
}: {
  params: { clubId: string; testId: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const test = await prisma.test.findFirst({
    where: {
      id: params.testId,
      clubId: params.clubId,
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

  let membership
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
    membership = await getUserMembership(session.user.id, params.clubId)
    if (!membership) {
      redirect('/dashboard')
    }

    isAdminUser = await isAdmin(session.user.id, params.clubId)

    // Admins can take any test, but members need proper access
    if (!isAdminUser) {
      // Check if test is published
      if (test.status !== 'PUBLISHED') {
        redirect(`/club/${params.clubId}?tab=tests`)
      }

      // Check if test is available (scheduling)
      const availability = isTestAvailable(test)
      if (!availability.available) {
        redirect(`/club/${params.clubId}?tab=tests`)
      }

      // Get user's event assignments from roster for event-based test access
      const userEventAssignments = await prisma.rosterAssignment.findMany({
        where: {
          membershipId: membership.id,
          team: { clubId: params.clubId },
        },
        select: { eventId: true },
      })
      const userEventIds = userEventAssignments.map(ra => ra.eventId)

      // Check assignment - must match logic in API routes
      // If test has no assignments, user cannot access it
      if (test.assignments.length === 0) {
        redirect(`/club/${params.clubId}?tab=tests`)
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
        redirect(`/club/${params.clubId}?tab=tests`)
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

  return (
    <TakeTestClient
      test={test}
      membership={membership}
      existingAttempt={existingAttempt}
      isAdmin={isAdminUser}
    />
  )
}


