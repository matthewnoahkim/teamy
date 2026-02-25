import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ClubPage } from '@/components/club-page'
import { Suspense } from 'react'
import { PageLoading } from '@/components/ui/loading-spinner'
import { CalendarScope, AnnouncementScope, Role } from '@prisma/client'
import { userSelectFields } from '@/types/models'
import { hasAnnouncementTargetAccess, hasTestAssignmentAccess } from '@/lib/club-authz'

// This page requires authentication (getServerSession), so ISR/static caching
// cannot be used. Force dynamic rendering for correct per-user data.
export const dynamic = 'force-dynamic'

export default async function ClubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const validTabs = new Set([
    'home',
    'stream',
    'people',
    'calendar',
    'attendance',
    'finance',
    'tests',
    'gallery',
    'paperwork',
    'todos',
    'tools',
    'stats',
    'settings',
  ])
  const requestedTab = resolvedSearchParams.tab || 'home'
  const activeTab = validTabs.has(requestedTab) ? requestedTab : 'home'

  const needsAttendanceData = activeTab === 'attendance'
  const needsFinanceData = activeTab === 'finance'
  const needsCalendarData = activeTab === 'home' || activeTab === 'calendar'
  const needsAnnouncementsData = activeTab === 'home' || activeTab === 'stream'
  const needsTestsData = activeTab === 'home' || activeTab === 'tests'
  const needsFullPeopleData = activeTab === 'people'

  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Wave 1: Fetch membership, user clubs, and club data in parallel.
  // People tab needs full roster/membership payload; other tabs use a lighter shape.
  const clubPromise = needsFullPeopleData
    ? prisma.club.findUnique({
        where: { id: resolvedParams.clubId },
        include: {
          memberships: {
            include: {
              user: {
                select: userSelectFields,
              },
              team: true,
              rosterAssignments: {
                include: { event: true },
              },
              preferences: true,
            },
          },
          teams: {
            include: {
              members: {
                include: {
                  user: {
                    select: userSelectFields,
                  },
                },
              },
              _count: {
                select: { rosterAssignments: true },
              },
            },
          },
        },
      })
    : prisma.club.findUnique({
        where: { id: resolvedParams.clubId },
        select: {
          id: true,
          name: true,
          division: true,
          backgroundType: true,
          backgroundColor: true,
          gradientStartColor: true,
          gradientEndColor: true,
          gradientColors: true,
          gradientDirection: true,
          backgroundImageUrl: true,
          createdAt: true,
          updatedAt: true,
          memberships: {
            select: {
              id: true,
              userId: true,
              clubId: true,
              role: true,
              roles: true,
              teamId: true,
              createdAt: true,
              updatedAt: true,
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
              user: {
                select: userSelectFields,
              },
            },
          },
          teams: {
            select: {
              id: true,
              clubId: true,
              name: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      })

  const [membership, userClubs, club] = await Promise.all([
    prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resolvedParams.clubId,
        },
      },
      include: { preferences: true },
    }),
    prisma.membership.findMany({
      where: { userId: session.user.id },
      select: {
        club: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    clubPromise,
  ])

  if (!membership) {
    redirect('/no-clubs')
  }
  if (!club) {
    redirect('/no-clubs')
  }

  const clubs = userClubs.map(m => m.club)
  const isAdminUser = membership.role === Role.ADMIN

  // Wave 2: Attendance, finance, and roster in one parallel batch.
  // Roster is also needed for announcement event-target visibility checks.
  const [
    attendances,
    expenses,
    purchaseRequests,
    eventBudgets,
    userRosterAssignments,
  ] = await Promise.all([
    needsAttendanceData
      ? prisma.attendance.findMany({
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
        })
      : Promise.resolve([]),
    needsFinanceData
      ? prisma.expense.findMany({
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
        })
      : Promise.resolve([]),
    needsFinanceData
      ? prisma.purchaseRequest.findMany({
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
        })
      : Promise.resolve([]),
    needsFinanceData
      ? prisma.eventBudget.findMany({
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
        })
      : Promise.resolve([]),
    (needsCalendarData || needsTestsData || needsAnnouncementsData)
      ? prisma.rosterAssignment.findMany({
          where: {
            membershipId: membership.id,
            team: { clubId: resolvedParams.clubId },
          },
          select: {
            eventId: true,
            teamId: true,
          },
        })
      : Promise.resolve([]),
  ])

  const rosterList = Array.isArray(userRosterAssignments) ? userRosterAssignments : []
  const userEventIds = rosterList.map(ra => ra.eventId)
  const userTeamIds = [...new Set(rosterList.map(ra => ra.teamId))]

  // Wave 3: Calendar, announcements, tests in parallel (depend on userTeamIds / userEventIds only for in-memory filter).
  const [calendarEvents, allAnnouncements, allTests] = await Promise.all([
    needsCalendarData
      ? prisma.calendarEvent.findMany({
          where: {
            clubId: resolvedParams.clubId,
            OR: [
              { scope: CalendarScope.CLUB },
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
      : Promise.resolve([]),
    needsAnnouncementsData
      ? prisma.announcement.findMany({
          where: {
            clubId: resolvedParams.clubId,
            ...(isAdminUser ? {} : {
              OR: [
                {
                  visibilities: {
                    some: {
                      scope: AnnouncementScope.CLUB,
                    },
                  },
                },
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
      : Promise.resolve([]),
    needsTestsData
      ? prisma.test.findMany({
          where: {
            clubId: resolvedParams.clubId,
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
      : Promise.resolve([]),
  ])

  // Calculate budget totals in-memory from already-fetched datasets to avoid N+1 DB aggregate queries.
  const pendingPurchaseRequests = (purchaseRequests ?? []).filter(request => request.status === 'PENDING')
  const budgetsWithTotals = (eventBudgets ?? []).map((budget) => {
    const spent = (expenses ?? []).reduce((sum, expense) => {
      if (expense.eventId !== budget.eventId) return sum
      if (budget.teamId && expense.teamId !== budget.teamId) return sum
      return sum + Number(expense.amount || 0)
    }, 0)

    const requested = pendingPurchaseRequests.reduce((sum, request) => {
      if (request.eventId !== budget.eventId) return sum
      if (budget.teamId && request.teamId !== budget.teamId) return sum
      return sum + Number(request.estimatedAmount || 0)
    }, 0)

    const remaining = budget.maxBudget - spent - requested

    return {
      ...budget,
      totalSpent: spent,
      totalRequested: requested,
      remaining,
    }
  })

  // Filter tests for non-admins based on assignments
  const allTestsList = Array.isArray(allTests) ? allTests : []
  let filteredTests = allTestsList
  if (!isAdminUser && needsTestsData) {
    filteredTests = allTestsList.filter(test =>
      hasTestAssignmentAccess(test.assignments, membership, userEventIds),
    )
  }

  // Remove assignments from tests (not needed by client)
  const tests = filteredTests.map(({ assignments: _assignments, ...test }) => test)
  const announcements = isAdminUser || !needsAnnouncementsData
    ? (allAnnouncements ?? [])
    : (allAnnouncements ?? []).filter((announcement) => {
        const targets = announcement.visibilities
          .filter(visibility => visibility.targetRole || visibility.eventId)
          .map(visibility => ({
            targetRole: visibility.targetRole,
            eventId: visibility.eventId,
          }))
        return hasAnnouncementTargetAccess(targets, membership, userEventIds)
      })

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
          attendances: attendances ?? [],
          expenses: expenses ?? [],
          purchaseRequests: purchaseRequests ?? [],
          eventBudgets: budgetsWithTotals,
          calendarEvents: calendarEvents ?? [],
          announcements: announcements ?? [],
          tests,
          // Gallery, paperwork, todos, and stats are fetched on-demand when tabs are clicked
          // This significantly improves initial page load time
        }}
      />
    </Suspense>
  )
}

