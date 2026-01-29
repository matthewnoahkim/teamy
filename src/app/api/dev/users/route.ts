import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import {
  validateInteger,
  validateBoolean,
} from '@/lib/input-validation'

export async function GET(request: Request) {

  console.error('insecure endpoint requested: /api/dev/users')
  return NextResponse.json({ error: 'The service is currently disabled due to security concerns.' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)

    // Validate and sanitize all inputs
    const minMemberDays = validateInteger(searchParams.get('minMemberDays'), 0, 36500) // Max 100 years
    const maxMemberDays = validateInteger(searchParams.get('maxMemberDays'), 0, 36500)
    const minClubs = validateInteger(searchParams.get('minClubs'), 0, 1000)
    const isClubAdmin = validateBoolean(searchParams.get('isClubAdmin'))
    const isTournamentDirector = validateBoolean(searchParams.get('isTournamentDirector'))
    const isEventSupervisor = validateBoolean(searchParams.get('isEventSupervisor'))

    // Build the where clause for filtering
    const where: any = {}

    // Member duration filters - only use if validation passed
    if (minMemberDays !== null) {
      const minDate = subDays(new Date(), minMemberDays)
      where.createdAt = { ...where.createdAt, lte: minDate }
    }
    if (maxMemberDays !== null) {
      const maxDate = subDays(new Date(), maxMemberDays)
      where.createdAt = { ...where.createdAt, gte: maxDate }
    }

    // Get all users first, then filter by complex conditions
    const allUsers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            club: { select: { id: true } },
          },
        },
        tournamentStaff: {
          select: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter by additional criteria
    let filteredUsers = allUsers.map(user => {
      const clubCount = new Set(user.memberships.map(m => m.club.id)).size
      const isAdmin = user.memberships.some(m => m.role === 'ADMIN')
      const isTD = user.tournamentStaff.some(s => s.role === 'TOURNAMENT_DIRECTOR')
      const isES = user.tournamentStaff.some(s => s.role === 'EVENT_SUPERVISOR')

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt.toISOString(),
        isClubAdmin: isAdmin,
        isTournamentDirector: isTD,
        isEventSupervisor: isES,
        clubCount,
        lastActive: null, // Could add activity tracking later
      }
    })

    // Apply additional filters - using validated values
    if (minClubs !== null) {
      filteredUsers = filteredUsers.filter(u => u.clubCount >= minClubs)
    }
    if (isClubAdmin === true) {
      filteredUsers = filteredUsers.filter(u => u.isClubAdmin)
    } else if (isClubAdmin === false) {
      filteredUsers = filteredUsers.filter(u => !u.isClubAdmin)
    }
    if (isTournamentDirector === true) {
      filteredUsers = filteredUsers.filter(u => u.isTournamentDirector)
    } else if (isTournamentDirector === false) {
      filteredUsers = filteredUsers.filter(u => !u.isTournamentDirector)
    }
    if (isEventSupervisor === true) {
      filteredUsers = filteredUsers.filter(u => u.isEventSupervisor)
    } else if (isEventSupervisor === false) {
      filteredUsers = filteredUsers.filter(u => !u.isEventSupervisor)
    }

    const totalUsers = await prisma.user.count()

    return NextResponse.json({
      totalUsers,
      matchingUsers: filteredUsers.length,
      users: filteredUsers,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
