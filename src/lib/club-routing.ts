import { prisma } from '@/lib/prisma'

type UserPreferencesRecord = Record<string, unknown>

function getPreferencesObject(preferences: unknown): UserPreferencesRecord {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return {}
  }
  return preferences as UserPreferencesRecord
}

export function getPrimaryClubIdFromPreferences(preferences: unknown): string | null {
  const value = getPreferencesObject(preferences).primaryClubId
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function getPreferredClubIdForUser(
  userId: string,
  options?: { lastVisitedClubId?: string | null }
): Promise<string | null> {
  if (!userId || typeof userId !== 'string') {
    return null
  }

  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: {
      clubId: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (memberships.length === 0) {
    return null
  }

  const membershipClubIds = memberships.map((membership) => membership.clubId)
  let primaryClubId: string | null = null

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
      },
    })
    primaryClubId = getPrimaryClubIdFromPreferences(user?.preferences)
  } catch (error) {
    console.error('Failed to load user preferences for preferred club routing:', error)
  }

  if (primaryClubId && membershipClubIds.includes(primaryClubId)) {
    return primaryClubId
  }

  const lastVisitedClubId = options?.lastVisitedClubId?.trim()
  if (lastVisitedClubId && membershipClubIds.includes(lastVisitedClubId)) {
    return lastVisitedClubId
  }

  return membershipClubIds[0] ?? null
}

export async function getPreferredClubPathForUser(
  userId: string,
  options?: { lastVisitedClubId?: string | null }
): Promise<string> {
  try {
    const preferredClubId = await getPreferredClubIdForUser(userId, options)
    return preferredClubId ? `/club/${preferredClubId}` : '/no-clubs'
  } catch (error) {
    console.error('Failed to resolve preferred club path:', error)
    return '/no-clubs'
  }
}

