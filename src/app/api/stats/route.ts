import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, isAdmin } from '@/lib/rbac'
import { logApiTiming } from '@/lib/api-timing'

// GET /api/stats?clubId=xxx - Get comprehensive stats for all club members
export async function GET(req: NextRequest) {
  const startedAtMs = performance.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID is required' }, { status: 400 })
    }

    await requireMember(session.user.id, clubId)

    // Only admins can view stats
    const isAdminUser = await isAdmin(session.user.id, clubId)
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Only admins can view stats' }, { status: 403 })
    }

    // Get club with division
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, division: true },
    })

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Get all memberships with user info
    const memberships = await prisma.membership.findMany({
      where: { clubId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        rosterAssignments: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    })

    // Try to get preferences separately (table might not exist yet)
    let preferencesMap: Record<string, unknown> = {}
    try {
      const preferences = await prisma.memberPreferences.findMany({
        where: { membershipId: { in: memberships.map(m => m.id) } },
      })
      preferencesMap = Object.fromEntries(preferences.map(p => [p.membershipId, p]))
    } catch {
      // MemberPreferences table might not exist yet
      console.log('MemberPreferences table not available')
    }

    // Load stats datasets in parallel to minimize API latency.
    const [testAttempts, attendanceRecords, todos, events] = await Promise.all([
      prisma.testAttempt.findMany({
        where: {
          test: { clubId },
          status: { in: ['SUBMITTED', 'GRADED'] },
        },
        select: {
          id: true,
          membershipId: true,
          gradeEarned: true,
          submittedAt: true,
          test: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.attendanceCheckIn.findMany({
        where: {
          attendance: { clubId },
        },
        select: {
          id: true,
          membershipId: true,
          createdAt: true,
          attendanceId: true,
        },
      }),
      prisma.todo.findMany({
        where: { clubId },
        select: {
          id: true,
          membershipId: true,
          completed: true,
          priority: true,
        },
      }),
      prisma.event.findMany({
        where: { division: club.division },
        select: {
          id: true,
          name: true,
          slug: true,
          maxCompetitors: true,
        },
        orderBy: { name: 'asc' },
      }),
    ])

    const attemptsByMembership = new Map<string, typeof testAttempts>()
    for (const attempt of testAttempts) {
      const bucket = attemptsByMembership.get(attempt.membershipId)
      if (bucket) {
        bucket.push(attempt)
      } else {
        attemptsByMembership.set(attempt.membershipId, [attempt])
      }
    }

    const attendanceByMembership = new Map<string, typeof attendanceRecords>()
    for (const record of attendanceRecords) {
      const bucket = attendanceByMembership.get(record.membershipId)
      if (bucket) {
        bucket.push(record)
      } else {
        attendanceByMembership.set(record.membershipId, [record])
      }
    }

    const todoStatsByMembership = new Map<string, { completed: number; total: number }>()
    for (const todo of todos) {
      const current = todoStatsByMembership.get(todo.membershipId) ?? { completed: 0, total: 0 }
      current.total += 1
      if (todo.completed) {
        current.completed += 1
      }
      todoStatsByMembership.set(todo.membershipId, current)
    }

    // Aggregate stats per member
    const memberStats = memberships.map(membership => {
      // Test stats
      const memberAttempts = attemptsByMembership.get(membership.id) ?? []
      const testScores = memberAttempts.map(a => ({
        testId: a.test.id,
        testName: a.test.name,
        score: a.gradeEarned ? Number(a.gradeEarned) : null,
        maxScore: 100, // TestAttempt stores gradeEarned as a percentage (Decimal 6,2)
        percentage: a.gradeEarned ? Number(a.gradeEarned) : null,
        submittedAt: a.submittedAt,
      }))
      const avgTestScore = testScores.length > 0
        ? testScores.reduce((sum, t) => sum + (t.percentage || 0), 0) / testScores.length
        : null

      // Attendance stats
      const memberAttendance = attendanceByMembership.get(membership.id) ?? []
      const attendanceCount = memberAttendance.length

      // Todo stats
      const todoStats = todoStatsByMembership.get(membership.id) ?? { completed: 0, total: 0 }
      const completedTodos = todoStats.completed
      const totalTodos = todoStats.total
      const todoCompletionRate = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : null

      // Current roster assignments
      const assignments = membership.rosterAssignments.map(a => ({
        eventId: a.event.id,
        eventName: a.event.name,
        eventSlug: a.event.slug,
      }))

      return {
        membershipId: membership.id,
        userId: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        image: membership.user.image,
        role: membership.role,
        team: membership.team,
        preferences: preferencesMap[membership.id] || null,
        stats: {
          testScores,
          avgTestScore,
          attendanceCount,
          attendanceRecords: memberAttendance.map(a => ({
            attendanceId: a.attendanceId,
            checkedInAt: a.createdAt,
          })),
          completedTodos,
          totalTodos,
          todoCompletionRate,
        },
        assignments,
      }
    })

    // Get teams
    const teams = await prisma.team.findMany({
      where: { clubId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })

    logApiTiming('/api/stats', startedAtMs, {
      clubId,
      memberCount: memberStats.length,
      eventCount: events.length,
      teamCount: teams.length,
    })

    return NextResponse.json({
      clubId,
      division: club.division,
      events,
      teams,
      members: memberStats,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
