/**
 * Server-only module for dev panel user operations.
 * Use via Server Actions - do not expose as a public HTTP API.
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subDays } from 'date-fns'
import {
  validateInteger,
  validateBoolean,
  sanitizeSearchQuery,
  validateId,
} from '@/lib/input-validation'

export interface DevUserFilters {
  minMemberDays?: string | number | null
  maxMemberDays?: string | number | null
  minClubs?: string | number | null
  isClubAdmin?: boolean | string | null
  isTournamentDirector?: boolean | string | null
  isEventSupervisor?: boolean | string | null
  search?: string | null
  limit?: string | number | null
}

export interface DevUser {
  id: string
  email: string
  name: string | null
  image: string | null
  createdAt: string
  isClubAdmin: boolean
  isTournamentDirector: boolean
  isEventSupervisor: boolean
  clubCount: number
  lastActive: string | null
}

export interface GetFilteredUsersResult {
  totalUsers: number
  matchingUsers: number
  users: DevUser[]
}

async function checkDevAccess(email?: string | null) {
  if (!email) return false

  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'dev_panel_email_whitelist' },
  })

  if (setting) {
    try {
      const emails = JSON.parse(setting.value)
      if (Array.isArray(emails) && emails.map((e: string) => e.toLowerCase()).includes(email.toLowerCase())) {
        return true
      }
    } catch (e) {
      console.error('Failed to parse email whitelist:', e)
    }
  }

  const defaultEmails = process.env.DEV_PANEL_DEFAULT_EMAILS
  if (defaultEmails) {
    const emailList = defaultEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
    return emailList.includes(email.toLowerCase())
  }

  return false
}

/**
 * Get filtered users for dev panel. Server-only - call via Server Action.
 */
export async function getFilteredUsers(
  filters: DevUserFilters
): Promise<{ success: true; data: GetFilteredUsersResult } | { success: false; error: string }> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return { success: false, error: 'Unauthorized' }
  }

  const hasAccess = await checkDevAccess(session.user.email)
  if (!hasAccess) {
    return { success: false, error: 'Forbidden' }
  }

  try {
    const toStr = (v: string | number | null | undefined) =>
      v === null || v === undefined ? undefined : String(v)
    const minMemberDays = validateInteger(toStr(filters.minMemberDays), 0, 36500)
    const maxMemberDays = validateInteger(toStr(filters.maxMemberDays), 0, 36500)
    const minClubs = validateInteger(toStr(filters.minClubs), 0, 1000)
    const limit = validateInteger(toStr(filters.limit), 1, 500, 50) ?? 50
    const isClubAdmin =
      filters.isClubAdmin === true || filters.isClubAdmin === false
        ? filters.isClubAdmin
        : validateBoolean(toStr(filters.isClubAdmin))
    const isTournamentDirector =
      filters.isTournamentDirector === true || filters.isTournamentDirector === false
        ? filters.isTournamentDirector
        : validateBoolean(toStr(filters.isTournamentDirector))
    const isEventSupervisor =
      filters.isEventSupervisor === true || filters.isEventSupervisor === false
        ? filters.isEventSupervisor
        : validateBoolean(toStr(filters.isEventSupervisor))
    const search = sanitizeSearchQuery(toStr(filters.search), 200)

    const where: Record<string, unknown> = {}

    if (search) {
      const searchConditions: Array<Record<string, unknown>> = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
      where.OR = searchConditions
    }

    const createdAtFilter: { lte?: Date; gte?: Date } = {}
    if (minMemberDays !== null) {
      createdAtFilter.lte = subDays(new Date(), minMemberDays as number)
    }
    if (maxMemberDays !== null) {
      createdAtFilter.gte = subDays(new Date(), maxMemberDays as number)
    }
    if (Object.keys(createdAtFilter).length > 0) {
      where.createdAt = createdAtFilter
    }

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

    let filteredUsers = allUsers.map((user) => {
      const clubCount = new Set(user.memberships.map((m) => m.club.id)).size
      const isAdmin = user.memberships.some((m) => m.role === 'ADMIN')
      const isTD = user.tournamentStaff.some((s) => s.role === 'TOURNAMENT_DIRECTOR')
      const isES = user.tournamentStaff.some((s) => s.role === 'EVENT_SUPERVISOR')

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
        lastActive: null,
      }
    })

    if (minClubs !== null) {
      filteredUsers = filteredUsers.filter((u) => u.clubCount >= (minClubs as number))
    }
    if (isClubAdmin === true) {
      filteredUsers = filteredUsers.filter((u) => u.isClubAdmin)
    } else if (isClubAdmin === false) {
      filteredUsers = filteredUsers.filter((u) => !u.isClubAdmin)
    }
    if (isTournamentDirector === true) {
      filteredUsers = filteredUsers.filter((u) => u.isTournamentDirector)
    } else if (isTournamentDirector === false) {
      filteredUsers = filteredUsers.filter((u) => !u.isTournamentDirector)
    }
    if (isEventSupervisor === true) {
      filteredUsers = filteredUsers.filter((u) => u.isEventSupervisor)
    } else if (isEventSupervisor === false) {
      filteredUsers = filteredUsers.filter((u) => !u.isEventSupervisor)
    }

    const totalUsers = await prisma.user.count()
    const matchingUsers = filteredUsers.length
    const users = filteredUsers.slice(0, limit)

    return {
      success: true,
      data: { totalUsers, matchingUsers, users },
    }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { success: false, error: 'Failed to fetch users' }
  }
}

/**
 * Delete a user from dev panel. Server-only - call via Server Action.
 */
export async function deleteUser(
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return { success: false, error: 'Unauthorized' }
  }

  const hasAccess = await checkDevAccess(session.user.email)
  if (!hasAccess) {
    return { success: false, error: 'Forbidden' }
  }

  const validatedId = validateId(userId)
  if (!validatedId) {
    return { success: false, error: 'Invalid user ID' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const clubsCreatedByUser = await tx.club.findMany({
        where: { createdById: validatedId },
        include: {
          memberships: {
            where: {
              role: 'ADMIN',
              userId: { not: validatedId },
            },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      for (const club of clubsCreatedByUser) {
        if (club.memberships.length > 0) {
          await tx.club.update({
            where: { id: club.id },
            data: { createdById: club.memberships[0].userId },
          })
        } else {
          const anyMember = await tx.membership.findFirst({
            where: {
              clubId: club.id,
              userId: { not: validatedId },
            },
            orderBy: { createdAt: 'asc' },
          })

          if (anyMember) {
            await tx.club.update({
              where: { id: club.id },
              data: { createdById: anyMember.userId },
            })
            await tx.membership.update({
              where: { id: anyMember.id },
              data: { role: 'ADMIN' },
            })
          } else {
            try {
              await tx.club.delete({
                where: { id: club.id },
              })
            } catch (_e) {
              throw new Error(
                `Cannot delete user: club "${club.name}" has no other members and cannot be transferred`
              )
            }
          }
        }
      }

      await tx.user.delete({
        where: { id: validatedId },
      })
    })

    try {
      await prisma.activityLog.create({
        data: {
          action: 'USER_DELETED',
          description: `User with ID ${validatedId} was deleted from dev panel`,
          logType: 'ADMIN_ACTION',
          severity: 'WARNING',
          route: 'dev-actions',
          metadata: { userId: validatedId },
        },
      })
    } catch (logError) {
      console.error('Failed to log user deletion:', logError)
    }

    return { success: true }
  } catch (err: unknown) {
    console.error('Error deleting user:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}
