import { prisma } from './prisma'
import { Role } from '@prisma/client'

/**
 * Get user's membership and role in a club
 */
export async function getUserMembership(userId: string, clubId: string) {
  return prisma.membership.findUnique({
    where: {
      userId_clubId: {
        userId,
        clubId,
      },
    },
    include: {
      club: true,
      team: true,
      user: true,
    },
  })
}

/**
 * Check if user is an admin of a club
 */
export async function isAdmin(userId: string, clubId: string): Promise<boolean> {
  const membership = await getUserMembership(userId, clubId)
  return membership?.role === Role.ADMIN
}

/**
 * Check if user is a member of a club (any role)
 */
export async function isMember(userId: string, clubId: string): Promise<boolean> {
  const membership = await getUserMembership(userId, clubId)
  return !!membership
}

/**
 * Require admin role, throw if not authorized
 */
export async function requireAdmin(userId: string, clubId: string) {
  const isAuth = await isAdmin(userId, clubId)
  if (!isAuth) {
    throw new Error('UNAUTHORIZED: Admin role required')
  }
}

/**
 * Require club membership (any role), throw if not authorized
 */
export async function requireMember(userId: string, clubId: string) {
  const isAuth = await isMember(userId, clubId)
  if (!isAuth) {
    throw new Error('UNAUTHORIZED: Club membership required')
  }
}

/**
 * Get all clubs a user belongs to
 */
export async function getUserClubs(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: {
      club: true,
      team: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

/**
 * Check if user is a tournament admin for a tournament
 */
export async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  
  if (admin) return true
  
  // Also check if user is the creator (creators should always have admin access)
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  return tournament?.createdById === userId
}

/**
 * Check if user is a tournament director for a tournament
 */
export async function isTournamentDirector(userId: string, userEmail: string, tournamentId: string): Promise<boolean> {
  // Check if user is tournament admin
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  
  if (admin) return true
  
  // Check if user created the tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  if (tournament?.createdById === userId) return true
  
  // Check if user is the director on the hosting request
  const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
    where: {
      tournament: {
        id: tournamentId,
      },
      directorEmail: {
        equals: userEmail,
        mode: 'insensitive',
      },
      status: 'APPROVED',
    },
  })
  
  if (hostingRequest) return true
  
  // Also check if user is a TD via TournamentStaff
  const staffRecord = await prisma.tournamentStaff.findFirst({
    where: {
      tournamentId,
      role: 'TOURNAMENT_DIRECTOR',
      status: 'ACCEPTED',
      OR: [
        { userId },
        {
          email: {
            equals: userEmail,
            mode: 'insensitive',
          },
        },
      ],
    },
  })
  
  return !!staffRecord
}

/**
 * Check if user is a tournament director OR event supervisor for a tournament
 * This gives full access to test management (create, edit, delete, view responses, release scores, etc.)
 */
export async function hasESAccess(userId: string, userEmail: string, tournamentId: string): Promise<boolean> {
  // Check if user is a tournament director
  const isTD = await isTournamentDirector(userId, userEmail, tournamentId)
  if (isTD) return true

  // Check if user is an event supervisor (any accepted staff member for this tournament)
  const staffRecord = await prisma.tournamentStaff.findFirst({
    where: {
      tournamentId,
      status: 'ACCEPTED',
      OR: [
        { userId },
        {
          email: {
            equals: userEmail,
            mode: 'insensitive',
          },
        },
      ],
    },
  })

  return !!staffRecord
}

/**
 * Check if user has access to a specific ES test
 * Tournament Directors: Full access to all tests
 * Event Supervisors: Access only to tests for events they're assigned to
 */
export async function hasESTestAccess(userId: string, userEmail: string, testId: string): Promise<boolean> {
  // Get the test to check its tournament and event
  const test = await prisma.eSTest.findUnique({
    where: { id: testId },
    select: { tournamentId: true, eventId: true },
  })

  if (!test) return false

  // Check if user is a tournament director (TDs have full access)
  const isTD = await isTournamentDirector(userId, userEmail, test.tournamentId)
  if (isTD) return true

  // For Event Supervisors, check if they're assigned to this test's event
  const staffMemberships = await prisma.tournamentStaff.findMany({
    where: {
      tournamentId: test.tournamentId,
      status: 'ACCEPTED',
      OR: [
        { userId },
        {
          email: {
            equals: userEmail,
            mode: 'insensitive',
          },
        },
      ],
    },
    include: {
      events: {
        select: { eventId: true },
      },
    },
  })

  if (staffMemberships.length === 0) return false

  // If test has an eventId, check if ES is assigned to that event
  if (test.eventId) {
    return staffMemberships.some(staff => 
      staff.events.some(e => e.eventId === test.eventId)
    )
  }

  // For trial events (eventId is null), check if ES is assigned to the trial event
  // Get trial event name from CREATE audit log
  const createAudit = await prisma.eSTestAudit.findFirst({
    where: {
      testId: testId,
      action: 'CREATE',
    },
    orderBy: { createdAt: 'desc' },
    select: { details: true },
  })

  if (createAudit && createAudit.details && typeof createAudit.details === 'object' && 'eventName' in createAudit.details) {
    const eventName = (createAudit.details as any).eventName
    if (eventName && typeof eventName === 'string') {
      // Check if any staff membership has this trial event assigned
      return staffMemberships.some(staff => {
        if (!staff.trialEvents) return false
        try {
          const parsed = JSON.parse(staff.trialEvents)
          if (Array.isArray(parsed)) {
            // Handle both old format (string[]) and new format ({ name, division }[])
            if (parsed.length > 0 && typeof parsed[0] === 'string') {
              return parsed.includes(eventName)
            } else {
              return parsed.some((e: any) => e.name === eventName)
            }
          }
        } catch (e) {
          return false
        }
        return false
      })
    }
  }

  // If we can't determine the trial event, deny access for ES (TDs already handled above)
  return false
}
