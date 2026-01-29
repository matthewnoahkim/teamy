import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays, subMonths, startOfDay, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30d'

    // Calculate date range
    let startDate: Date
    let dateFormat: string
    let intervals: Date[]

    switch (range) {
      case '7d':
        startDate = subDays(new Date(), 7)
        intervals = eachDayOfInterval({ start: startDate, end: new Date() })
        dateFormat = 'MMM d'
        break
      case '30d':
        startDate = subDays(new Date(), 30)
        intervals = eachDayOfInterval({ start: startDate, end: new Date() })
        dateFormat = 'MMM d'
        break
      case '90d':
        startDate = subDays(new Date(), 90)
        intervals = eachWeekOfInterval({ start: startDate, end: new Date() })
        dateFormat = 'MMM d'
        break
      case '1y':
        startDate = subMonths(new Date(), 12)
        intervals = eachMonthOfInterval({ start: startDate, end: new Date() })
        dateFormat = 'MMM yyyy'
        break
      default:
        startDate = subDays(new Date(), 30)
        intervals = eachDayOfInterval({ start: startDate, end: new Date() })
        dateFormat = 'MMM d'
    }

    // Overview stats
    const [
      totalUsers,
      totalClubs,
      totalTournaments,
      totalMemberships,
      activeUsersLast7Days,
      activeUsersLast30Days,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.club.count(),
      prisma.tournament.count(),
      prisma.membership.count(),
      prisma.user.count({
        where: {
          OR: [
            { updatedAt: { gte: subDays(new Date(), 7) } },
            { memberships: { some: { updatedAt: { gte: subDays(new Date(), 7) } } } },
          ],
        },
      }),
      prisma.user.count({
        where: {
          OR: [
            { updatedAt: { gte: subDays(new Date(), 30) } },
            { memberships: { some: { updatedAt: { gte: subDays(new Date(), 30) } } } },
          ],
        },
      }),
    ])

    // User growth data
    const usersByDate = await prisma.user.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: startDate } },
      _count: true,
      orderBy: { createdAt: 'asc' },
    })

    // Aggregate by date
    const userGrowthMap = new Map<string, number>()
    usersByDate.forEach(item => {
      const date = format(startOfDay(new Date(item.createdAt)), 'yyyy-MM-dd')
      userGrowthMap.set(date, (userGrowthMap.get(date) || 0) + item._count)
    })

    // Get cumulative user count before start date
    const usersBeforeStart = await prisma.user.count({
      where: { createdAt: { lt: startDate } },
    })

    // Build growth data with cumulative
    let cumulative = usersBeforeStart
    const userGrowth = intervals.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd')
      const count = userGrowthMap.get(dateKey) || 0
      cumulative += count
      return {
        date: date.toISOString(),
        count,
        cumulative,
      }
    }).filter(item => item.count > 0 || intervals.indexOf(new Date(item.date)) === intervals.length - 1)

    // Club growth data
    const clubsByDate = await prisma.club.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: startDate } },
      _count: true,
      orderBy: { createdAt: 'asc' },
    })

    const clubGrowthMap = new Map<string, number>()
    clubsByDate.forEach(item => {
      const date = format(startOfDay(new Date(item.createdAt)), 'yyyy-MM-dd')
      clubGrowthMap.set(date, (clubGrowthMap.get(date) || 0) + item._count)
    })

    const clubsBeforeStart = await prisma.club.count({
      where: { createdAt: { lt: startDate } },
    })

    let clubCumulative = clubsBeforeStart
    const clubGrowth = intervals.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd')
      const count = clubGrowthMap.get(dateKey) || 0
      clubCumulative += count
      return {
        date: date.toISOString(),
        count,
        cumulative: clubCumulative,
      }
    }).filter(item => item.count > 0 || intervals.indexOf(new Date(item.date)) === intervals.length - 1)

    // Top users by club count
    const topUsersRaw = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: {
        memberships: { _count: 'desc' },
      },
      take: 10,
    })

    const topUsers = topUsersRaw.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      clubCount: u._count.memberships,
      createdAt: u.createdAt.toISOString(),
      lastActive: u.updatedAt.toISOString(),
    }))

    // Recent signups
    const recentSignups = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Role distribution
    const [clubAdmins, tournamentDirectors, eventSupervisors] = await Promise.all([
      prisma.membership.findMany({
        where: { role: 'ADMIN' },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.tournamentStaff.findMany({
        where: { role: 'TOURNAMENT_DIRECTOR' },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.tournamentStaff.findMany({
        where: { role: 'EVENT_SUPERVISOR' },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ])

    // Regular members = total users - unique users with any special role
    const specialUserIds = new Set([
      ...clubAdmins.map(m => m.userId),
      ...tournamentDirectors.map(s => s.userId),
      ...eventSupervisors.map(s => s.userId),
    ])

    const roleDistribution = {
      clubAdmins: clubAdmins.length,
      tournamentDirectors: tournamentDirectors.length,
      eventSupervisors: eventSupervisors.length,
      regularMembers: totalUsers - specialUserIds.size,
    }

    return NextResponse.json({
      overview: {
        totalUsers,
        totalClubs,
        totalTournaments,
        totalMemberships,
        activeUsersLast7Days,
        activeUsersLast30Days,
      },
      userGrowth,
      clubGrowth,
      topUsers,
      recentSignups: recentSignups.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
      })),
      roleDistribution,
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
