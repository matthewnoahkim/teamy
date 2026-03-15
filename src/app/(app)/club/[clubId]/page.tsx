import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ClubPage } from '@/components/club-page'
import { Suspense } from 'react'
import { CalendarScope, AnnouncementScope, Role } from '@prisma/client'
import { userSelectFields } from '@/types/models'
import { hasAnnouncementTargetAccess, hasTestAssignmentAccess } from '@/lib/club-authz'

// This page requires authentication (getServerSession), so ISR/static caching
// cannot be used. Force dynamic rendering for correct per-user data.
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Skeleton shown immediately while ClubDataLoader fetches data server-side.
// ---------------------------------------------------------------------------
function ClubPageSkeleton() {
  return (
    <div className="min-h-screen bg-background grid-pattern animate-pulse">
      {/* Header skeleton */}
      <div className="h-16 bg-card/80 border-b border-border/50" />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 max-w-full">
        <div className="flex gap-4 sm:gap-6 lg:gap-8 items-start">
          {/* Sidebar skeleton */}
          <aside className="w-48 lg:w-52 flex-shrink-0 hidden md:block">
            <div className="bg-card/80 border border-border/50 p-3 rounded-2xl space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 sm:h-11 bg-muted rounded-2xl" />
              ))}
            </div>
          </aside>
          {/* Content skeleton */}
          <div className="flex-1 min-w-0 pl-9 sm:pl-10 md:pl-0 space-y-3">
            <div className="h-8 bg-muted rounded-xl w-1/3" />
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl w-2/3" />
          </div>
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page shell — synchronous so Next.js can stream the skeleton to the browser
// immediately, while ClubDataLoader does all the async work behind the scenes.
// ---------------------------------------------------------------------------
export default function ClubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  return (
    <Suspense fallback={<ClubPageSkeleton />}>
      <ClubDataLoader params={params} searchParams={searchParams} />
    </Suspense>
  )
}

// ---------------------------------------------------------------------------
// Async component: all data-fetching happens here. Suspense streams the
// skeleton until this resolves, then swaps in the real content.
// ---------------------------------------------------------------------------
async function ClubDataLoader({
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

  const needsSettingsData = activeTab === 'settings'
  const needsAttendanceData = activeTab === 'attendance'
  const needsFinanceData = activeTab === 'finance'
  const needsFullPeopleData = activeTab === 'people'
  // Only fetch tab-specific data when needed. The home tab needs a limited set for widgets;
  // individual tabs fetch full data client-side if not pre-loaded.
  const needsCalendarData = activeTab === 'home' || activeTab === 'calendar'
  const needsAnnouncementsData = activeTab === 'home' || activeTab === 'stream'
  const needsTestsData = activeTab === 'home' || activeTab === 'tests'
  // When on the home tab, limit the number of records for widget previews.
  // The actual tabs will fetch their own data client-side.
  const isHomeTab = activeTab === 'home'

  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Wave 1: Fetch membership and club data in parallel.
  // People tab needs full roster/membership payload; other tabs use a lighter shape.
  const clubPromise = needsFullPeopleData
    ? prisma.club.findUnique({
        where: { id: resolvedParams.clubId },
        include: {
          _count: {
            select: { memberships: true },
          },
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
    : needsSettingsData
    ? prisma.club.findUnique({
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
          _count: {
            select: { memberships: true },
          },
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
          _count: {
            select: { memberships: true },
          },
          memberships: {
            where: { userId: session.user.id },
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

  const [membership, club] = await Promise.all([
    prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resolvedParams.clubId,
        },
      },
      include: {
        preferences: true,
        // Fetch roster IDs here so Wave 2 can start immediately after Wave 1
        // without a dedicated Wave 2 round-trip just for these IDs.
        rosterAssignments: { select: { eventId: true, teamId: true } },
      },
    }),
    clubPromise,
  ])

  if (!membership) {
    // Route through home so users removed from a club follow the same path as self-leave.
    redirect('/')
  }
  if (!club) {
    redirect('/no-clubs')
  }

  const isAdminUser = membership.role === Role.ADMIN

  // Roster IDs are already on the membership (fetched in Wave 1).
  const rosterList = membership.rosterAssignments ?? []
  const userEventIds = rosterList.map(ra => ra.eventId)
  const userTeamIds = [...new Set(rosterList.map(ra => ra.teamId))]

  // Wave 2: All remaining data in one parallel batch.
  // Calendar/announcements/tests can now start immediately (no longer blocked
  // by a dedicated roster round-trip) because roster IDs came from Wave 1.
  const [
    attendances,
    expenses,
    purchaseRequests,
    eventBudgets,
    calendarEvents,
    allAnnouncements,
    allTests,
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
            team: { select: { id: true, name: true, clubId: true } },
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
          ...(isHomeTab ? { take: 50 } : {}),
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
                team: { select: { id: true, name: true } },
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
                team: { select: { id: true, name: true } },
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
          ...(isHomeTab ? { take: 20 } : {}),
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
          ...(isHomeTab ? { take: 20 } : {}),
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
    <ClubPage
      club={club}
      currentMembership={membership}
      user={session.user}
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
  )
}
