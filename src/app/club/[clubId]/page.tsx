import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ClubPage } from '@/components/club-page'
import { Suspense } from 'react'
import { PageLoading } from '@/components/ui/loading-spinner'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { CalendarScope, AnnouncementScope } from '@prisma/client'

// Enable ISR (Incremental Static Regeneration) for faster page loads
// Revalidate every 60 seconds in production
export const revalidate = 60

export default async function ClubDetailPage({ params }: { params: Promise<{ clubId: string }> }) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Check membership
  const membership = await prisma.membership.findUnique({
    where: {
      userId_clubId: {
        userId: session.user.id,
        clubId: resolvedParams.clubId,
      },
    },
    include: {
      preferences: true,
    },
  })

  if (!membership) {
    // User is not a member, redirect to no-clubs page
    redirect('/no-clubs')
  }

  // Get all user's clubs for the dropdown
  const userClubs = await prisma.membership.findMany({
    where: { userId: session.user.id },
    select: {
      club: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const clubs = userClubs.map(m => m.club)

  const club = await prisma.club.findUnique({
    where: { id: resolvedParams.clubId },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          team: true,
          rosterAssignments: {
            include: {
              event: true,
            },
          },
          preferences: true,
        },
      },
      teams: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          _count: {
            select: {
              rosterAssignments: true,
            },
          },
        },
      },
    },
  })

  if (!club) {
    redirect('/no-clubs')
  }

  // Check if user is admin (needed for filtering)
  const isAdminUser = await isAdmin(session.user.id, resolvedParams.clubId)

  // Fetch only critical data for initial page render (homepage tab + finance tab)
  // Other tab data (gallery, paperwork, todos, stats) is fetched on-demand when tabs are clicked for faster initial load
  // This significantly reduces initial page load time
  const [attendances, expenses, purchaseRequests, eventBudgets] = await Promise.all([
    // Attendance data
    prisma.attendance.findMany({
      where: { calendarEvent: { clubId: resolvedParams.clubId } },
      include: {
        calendarEvent: {
          include: {
            team: true,
          },
        },
        checkIns: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            checkIns: true,
          },
        },
      },
      orderBy: {
        calendarEvent: {
          startUTC: 'desc',
        },
      },
    }),
    // Expenses data
    prisma.expense.findMany({
      where: { clubId: resolvedParams.clubId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        purchaseRequest: {
          select: {
            id: true,
            requesterId: true,
            description: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    }),
    // Purchase requests data
    prisma.purchaseRequest.findMany({
      where: { clubId: resolvedParams.clubId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        expense: {
          select: {
            id: true,
            amount: true,
            date: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    // Event budgets data
    prisma.eventBudget.findMany({
      where: { clubId: resolvedParams.clubId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
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
    }),
  ])

  // Calculate budget totals (same logic as API)
  const budgetsWithTotals = await Promise.all(
    eventBudgets.map(async (budget) => {
      const totalSpent = await prisma.expense.aggregate({
        where: {
          clubId: resolvedParams.clubId,
          eventId: budget.eventId,
          ...(budget.teamId && {
            addedBy: {
              teamId: budget.teamId,
            },
          }),
        },
        _sum: {
          amount: true,
        },
      })

      const totalRequested = await prisma.purchaseRequest.aggregate({
        where: {
          clubId: resolvedParams.clubId,
          eventId: budget.eventId,
          status: 'PENDING',
          ...(budget.teamId && {
            teamId: budget.teamId,
          }),
        },
        _sum: {
          estimatedAmount: true,
        },
      })

      const spent = totalSpent._sum.amount || 0
      const requested = totalRequested._sum.estimatedAmount || 0
      const remaining = budget.maxBudget - spent - requested

      return {
        ...budget,
        totalSpent: spent,
        totalRequested: requested,
        remaining,
      }
    })
  )

  // Fetch calendar events for homepage (with proper filtering)
  // Get user's event assignments from roster (for filtering targeted events)
  const userRosterAssignments = await prisma.rosterAssignment.findMany({
    where: {
      membershipId: membership.id,
      team: { clubId: resolvedParams.clubId },
    },
    select: { 
      eventId: true,
      teamId: true,
    },
  })
  const userEventIds = userRosterAssignments.map(ra => ra.eventId)
  const userTeamIds = [...new Set(userRosterAssignments.map(ra => ra.teamId))]

  // Get events visible to this user (simplified version for homepage)
  const calendarEvents = await prisma.calendarEvent.findMany({
    where: {
      clubId: resolvedParams.clubId,
      OR: [
        // Club-wide events
        { scope: CalendarScope.CLUB },
        // Team events
        ...(isAdminUser
          ? [{ scope: CalendarScope.TEAM }]
          : membership.teamId
          ? [
              { scope: CalendarScope.TEAM, teamId: membership.teamId },
              ...(userTeamIds.length > 0 ? [{ scope: CalendarScope.TEAM, teamId: { in: userTeamIds } }] : []),
            ]
          : userTeamIds.length > 0
          ? [{ scope: CalendarScope.TEAM, teamId: { in: userTeamIds } }]
          : []),
        // Personal events for this user only
        { scope: CalendarScope.PERSONAL, attendeeId: membership.id },
      ],
    },
    include: {
      creator: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      team: true,
      attendee: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      rsvps: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      attachments: {
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      targets: true,
      test: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      startUTC: 'asc',
    },
  })

  // Filter events based on targets (simplified - just filter out events with targets that don't match)
  // For homepage, we'll show all events and let the API handle complex filtering on refresh
  const filteredEvents = calendarEvents.filter((event) => {
    // If event has targets, check if user matches
    if (event.targets && event.targets.length > 0) {
      // For homepage, show all events - complex filtering happens in API
      // This is a simplified version
      return true
    }
    return true
  })

  // Fetch announcements for homepage (with proper filtering)
  const announcements = await prisma.announcement.findMany({
    where: {
      clubId: resolvedParams.clubId,
      // Admins see all announcements for the club
      ...(isAdminUser ? {} : {
        OR: [
          // Club-wide announcements
          {
            visibilities: {
              some: {
                scope: AnnouncementScope.CLUB,
              },
            },
          },
          // Team announcements for user's team
          ...(membership.teamId
            ? [{
                visibilities: {
                  some: {
                    scope: AnnouncementScope.TEAM,
                    teamId: membership.teamId,
                  },
                },
              }]
            : []),
        ],
      }),
    },
    include: {
      author: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      visibilities: {
        include: {
          team: true,
        },
      },
      replies: {
        include: {
          author: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          replies: true,
          reactions: true,
        },
      },
      calendarEvent: {
        include: {
          rsvps: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          team: true,
        },
      },
      attachments: {
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Fetch tests for homepage (with proper filtering)
  const allTests = await prisma.test.findMany({
    where: {
      clubId: resolvedParams.clubId,
      // Non-admins only see published tests
      ...(!isAdminUser && { status: 'PUBLISHED' }),
    },
    select: {
      id: true,
      name: true,
      description: true,
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
      releaseScoresAt: true,
      maxAttempts: true,
      scoreReleaseMode: true,
      createdAt: true,
      updatedAt: true,
      assignments: {
        select: {
          assignedScope: true,
          teamId: true,
          targetMembershipId: true,
          eventId: true,
        },
      },
      _count: {
        select: {
          questions: true,
          attempts: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Filter tests for non-admins based on assignments
  let filteredTests = allTests
  if (!isAdminUser) {
    filteredTests = allTests.filter(test => {
      // If test has no assignments, user cannot see it
      if (test.assignments.length === 0) {
        return false
      }

      // Check if any assignment grants access
      return test.assignments.some(a => {
        // CLUB scope - everyone gets access
        if (a.assignedScope === 'CLUB') {
          return true
        }
        // Team assignment - user must be in that team
        if (a.teamId && membership.teamId && a.teamId === membership.teamId) {
          return true
        }
        // Personal assignment - must be assigned to this user
        if (a.targetMembershipId === membership.id) {
          return true
        }
        // Event assignment - user must have this event in their roster
        if (a.eventId && userEventIds.includes(a.eventId)) {
          return true
        }
        return false
      })
    })
  }

  // Remove assignments from tests (not needed by client)
  const tests = filteredTests.map(({ assignments, ...test }) => test)

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4 py-12">
        <PageLoading 
          title="Loading club" 
          description="Fetching club data and member information..." 
          variant="orbit" 
        />
      </div>
    }>
      <ClubPage
        club={club}
        currentMembership={membership}
        user={session.user}
        clubs={clubs}
        initialData={{
          attendances,
          expenses,
          purchaseRequests,
          eventBudgets: budgetsWithTotals,
          calendarEvents: filteredEvents,
          announcements,
          tests,
          // Gallery, paperwork, todos, and stats are fetched on-demand when tabs are clicked
          // This significantly improves initial page load time
        }}
      />
    </Suspense>
  )
}

