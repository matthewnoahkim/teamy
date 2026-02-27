import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logApiTiming } from '@/lib/api-timing'
import {
  hasAnnouncementTargetAccess,
  hasTestAssignmentAccess,
  type MembershipAuthzContext,
} from '@/lib/club-authz'
import {
  PEOPLE_ACTIVITY_ACTIONS,
  shouldCountPeopleActivityAsUnread,
} from '@/lib/people-notifications'
import { serverSession } from '@/lib/server-session'
import {
  AnnouncementScope,
  CalendarScope,
  Role,
  TestAssignmentScope,
} from '@prisma/client'

const SUPPORTED_TABS = ['stream', 'calendar', 'attendance', 'finance', 'tests', 'people'] as const
type NotificationTab = (typeof SUPPORTED_TABS)[number]

function parseSince(raw: string | null): Date {
  if (!raw) return new Date(0)
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

function parseTabs(raw: string | null): NotificationTab[] {
  if (!raw) return [...SUPPORTED_TABS]
  const parsed = raw
    .split(',')
    .map(tab => tab.trim())
    .filter((tab): tab is NotificationTab =>
      (SUPPORTED_TABS as readonly string[]).includes(tab),
    )
  return parsed.length > 0 ? [...new Set(parsed)] : [...SUPPORTED_TABS]
}

type CalendarCandidate = {
  scope: CalendarScope
  testId: string | null
  test: {
    assignments: CalendarTestAssignment[]
  } | null
  targets: Array<{
    targetRole: string | null
    eventId: string | null
  }>
}

type CalendarTestAssignment = {
  assignedScope: TestAssignmentScope
  teamId: string | null
  targetMembershipId: string | null
  eventId: string | null
}

function hasCalendarAccess(
  event: CalendarCandidate,
  membership: MembershipAuthzContext,
  userEventIds: string[],
): boolean {
  if (event.testId && event.test) {
    return hasTestAssignmentAccess(event.test.assignments, membership, userEventIds)
  }

  if (event.scope === CalendarScope.TEAM || event.scope === CalendarScope.PERSONAL) {
    return true
  }

  if (event.targets.length === 0) {
    return true
  }

  return hasAnnouncementTargetAccess(event.targets, membership, userEventIds)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const startedAtMs = performance.now()
  const resolvedParams = await params

  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resolvedParams.clubId,
        },
      },
      select: {
        id: true,
        userId: true,
        teamId: true,
        role: true,
        roles: true,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const isAdminUser = membership.role === Role.ADMIN
    const searchParams = req.nextUrl.searchParams
    const tabs = parseTabs(searchParams.get('tabs'))

    const needsRosterData =
      !isAdminUser && tabs.some(tab => tab === 'stream' || tab === 'calendar' || tab === 'attendance' || tab === 'tests')

    const userRosterAssignments = needsRosterData
      ? await prisma.rosterAssignment.findMany({
          where: {
            membershipId: membership.id,
            team: { clubId: resolvedParams.clubId },
          },
          select: {
            eventId: true,
            teamId: true,
          },
        })
      : []

    const userEventIds = userRosterAssignments.map(ra => ra.eventId)
    const userTeamIds = [...new Set(userRosterAssignments.map(ra => ra.teamId))]
    const notifications: Partial<Record<NotificationTab, boolean>> = {}

    const calendarSinceCache = new Map<number, Promise<boolean>>()
    const hasVisibleCalendarActivitySince = (since: Date) => {
      const key = since.getTime()
      const cached = calendarSinceCache.get(key)
      if (cached) return cached

      const query = (async () => {
        const events = await prisma.calendarEvent.findMany({
          where: {
            clubId: resolvedParams.clubId,
            createdAt: { gt: since },
            creator: {
              userId: { not: session.user.id },
            },
            OR: [
              { scope: CalendarScope.CLUB },
              ...(isAdminUser
                ? [{ scope: CalendarScope.TEAM }]
                : membership.teamId
                ? [
                    { scope: CalendarScope.TEAM, teamId: membership.teamId },
                    ...(userTeamIds.length > 0
                      ? [{ scope: CalendarScope.TEAM, teamId: { in: userTeamIds } }]
                      : []),
                  ]
                : userTeamIds.length > 0
                ? [{ scope: CalendarScope.TEAM, teamId: { in: userTeamIds } }]
                : []),
              { scope: CalendarScope.PERSONAL, attendeeId: membership.id },
            ],
          },
          select: {
            scope: true,
            testId: true,
            targets: {
              select: {
                targetRole: true,
                eventId: true,
              },
            },
            test: {
              select: {
                assignments: {
                  select: {
                    assignedScope: true,
                    teamId: true,
                    targetMembershipId: true,
                    eventId: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })

        if (isAdminUser) {
          return events.length > 0
        }

        return events.some(event => hasCalendarAccess(event, membership, userEventIds))
      })()

      calendarSinceCache.set(key, query)
      return query
    }

    const tasks: Promise<void>[] = []

    if (tabs.includes('stream')) {
      tasks.push(
        (async () => {
          const streamSince = parseSince(searchParams.get('streamSince'))
          const announcements = await prisma.announcement.findMany({
            where: {
              clubId: resolvedParams.clubId,
              createdAt: { gt: streamSince },
              author: {
                userId: { not: session.user.id },
              },
              ...(isAdminUser
                ? {}
                : {
                    OR: [
                      {
                        visibilities: {
                          some: {
                            scope: AnnouncementScope.CLUB,
                          },
                        },
                      },
                      ...(membership.teamId
                        ? [
                            {
                              visibilities: {
                                some: {
                                  scope: AnnouncementScope.TEAM,
                                  teamId: membership.teamId,
                                },
                              },
                            },
                          ]
                        : []),
                    ],
                  }),
            },
            select: {
              id: true,
              visibilities: {
                select: {
                  targetRole: true,
                  eventId: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })

          notifications.stream = isAdminUser
            ? announcements.length > 0
            : announcements.some((announcement) => {
                const targets = announcement.visibilities
                  .filter(visibility => visibility.targetRole || visibility.eventId)
                  .map(visibility => ({
                    targetRole: visibility.targetRole,
                    eventId: visibility.eventId,
                  }))
                return hasAnnouncementTargetAccess(targets, membership, userEventIds)
              })
        })(),
      )
    }

    if (tabs.includes('calendar')) {
      tasks.push(
        (async () => {
          const calendarSince = parseSince(searchParams.get('calendarSince'))
          notifications.calendar = await hasVisibleCalendarActivitySince(calendarSince)
        })(),
      )
    }

    if (tabs.includes('attendance')) {
      tasks.push(
        (async () => {
          const attendanceSince = parseSince(searchParams.get('attendanceSince'))
          const [hasAttendanceCheckIn, hasCalendarActivity] = await Promise.all([
            prisma.attendanceCheckIn.findFirst({
              where: {
                createdAt: { gt: attendanceSince },
                membershipId: { not: membership.id },
                attendance: { clubId: resolvedParams.clubId },
              },
              select: { id: true },
              orderBy: { createdAt: 'desc' },
            }),
            hasVisibleCalendarActivitySince(attendanceSince),
          ])

          notifications.attendance = !!hasAttendanceCheckIn || hasCalendarActivity
        })(),
      )
    }

    if (tabs.includes('finance')) {
      tasks.push(
        (async () => {
          const financeSince = parseSince(searchParams.get('financeSince'))
          const [newRequest, newExpense, newApproval] = await Promise.all([
            prisma.purchaseRequest.findFirst({
              where: {
                clubId: resolvedParams.clubId,
                createdAt: { gt: financeSince },
                requesterId: { not: membership.id },
              },
              select: { id: true },
              orderBy: { createdAt: 'desc' },
            }),
            prisma.expense.findFirst({
              where: {
                clubId: resolvedParams.clubId,
                createdAt: { gt: financeSince },
                addedById: { not: membership.id },
              },
              select: { id: true },
              orderBy: { createdAt: 'desc' },
            }),
            prisma.purchaseRequest.findFirst({
              where: {
                clubId: resolvedParams.clubId,
                status: 'APPROVED',
                reviewedAt: { gt: financeSince },
                requesterId: { not: membership.id },
              },
              select: { id: true },
              orderBy: { reviewedAt: 'desc' },
            }),
          ])

          notifications.finance = !!newRequest || !!newExpense || !!newApproval
        })(),
      )
    }

    if (tabs.includes('tests')) {
      tasks.push(
        (async () => {
          const testsSince = parseSince(searchParams.get('testsSince'))
          const hasNewTests = isAdminUser
            ? await prisma.test.findFirst({
                where: {
                  clubId: resolvedParams.clubId,
                  createdAt: { gt: testsSince },
                  createdByMembershipId: { not: membership.id },
                },
                select: { id: true },
                orderBy: { createdAt: 'desc' },
              })
            : await prisma.test.findFirst({
                where: {
                  clubId: resolvedParams.clubId,
                  status: 'PUBLISHED',
                  createdAt: { gt: testsSince },
                  createdByMembershipId: { not: membership.id },
                  assignments: {
                    some: {
                      OR: [
                        { assignedScope: TestAssignmentScope.CLUB },
                        ...(membership.teamId ? [{ teamId: membership.teamId }] : []),
                        { targetMembershipId: membership.id },
                        ...(userEventIds.length > 0 ? [{ eventId: { in: userEventIds } }] : []),
                      ],
                    },
                  },
                },
                select: { id: true },
                orderBy: { createdAt: 'desc' },
              })

          notifications.tests = !!hasNewTests
        })(),
      )
    }

    if (tabs.includes('people')) {
      tasks.push(
        (async () => {
          const peopleSince = parseSince(searchParams.get('peopleSince'))
          const [hasNewPeople, recentPeopleActivityLogs] = await Promise.all([
            prisma.membership.findFirst({
              where: {
                clubId: resolvedParams.clubId,
                createdAt: { gt: peopleSince },
                userId: { not: session.user.id },
              },
              select: { id: true },
              orderBy: { createdAt: 'desc' },
            }),
            prisma.activityLog.findMany({
              where: {
                action: { in: [...PEOPLE_ACTIVITY_ACTIONS] },
                timestamp: { gt: peopleSince },
                OR: [{ userId: null }, { userId: { not: session.user.id } }],
              },
              select: {
                action: true,
                userId: true,
                metadata: true,
              },
              orderBy: { timestamp: 'desc' },
              take: 200,
            }),
          ])

          const hasNewPeopleActivity = recentPeopleActivityLogs.some((log) =>
            shouldCountPeopleActivityAsUnread({
              action: log.action,
              clubId: resolvedParams.clubId,
              viewerUserId: session.user.id,
              actorUserId: log.userId,
              metadata:
                log.metadata && typeof log.metadata === 'object'
                  ? (log.metadata as Record<string, unknown>)
                  : null,
            }),
          )

          notifications.people = !!hasNewPeople || hasNewPeopleActivity
        })(),
      )
    }

    await Promise.all(tasks)
    logApiTiming('/api/clubs/[clubId]/notifications', startedAtMs, {
      clubId: resolvedParams.clubId,
      tabCount: tabs.length,
    })
    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('Get club notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
