import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    
    const minMemberDays = searchParams.get('minMemberDays')
    const maxMemberDays = searchParams.get('maxMemberDays')
    const minClubs = searchParams.get('minClubs')
    const isClubAdmin = searchParams.get('isClubAdmin')
    const isTournamentDirector = searchParams.get('isTournamentDirector')
    const isEventSupervisor = searchParams.get('isEventSupervisor')

    // Build the where clause for filtering
    const where: any = {}
    
    // Member duration filters
    if (minMemberDays) {
      const minDate = subDays(new Date(), parseInt(minMemberDays))
      where.createdAt = { ...where.createdAt, lte: minDate }
    }
    if (maxMemberDays) {
      const maxDate = subDays(new Date(), parseInt(maxMemberDays))
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

    // Apply additional filters
    if (minClubs) {
      filteredUsers = filteredUsers.filter(u => u.clubCount >= parseInt(minClubs))
    }
    if (isClubAdmin === 'true') {
      filteredUsers = filteredUsers.filter(u => u.isClubAdmin)
    } else if (isClubAdmin === 'false') {
      filteredUsers = filteredUsers.filter(u => !u.isClubAdmin)
    }
    if (isTournamentDirector === 'true') {
      filteredUsers = filteredUsers.filter(u => u.isTournamentDirector)
    } else if (isTournamentDirector === 'false') {
      filteredUsers = filteredUsers.filter(u => !u.isTournamentDirector)
    }
    if (isEventSupervisor === 'true') {
      filteredUsers = filteredUsers.filter(u => u.isEventSupervisor)
    } else if (isEventSupervisor === 'false') {
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
