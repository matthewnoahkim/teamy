import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { serverSession } from '@/lib/server-session'

const SUPPORTED_TABS = ['stream', 'calendar', 'attendance', 'finance', 'tests', 'people'] as const
type NotificationTab = (typeof SUPPORTED_TABS)[number]
const SUPPORTED_TAB_SET = new Set<string>(SUPPORTED_TABS)

function getObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function parseSeenAt(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getAllSeenByClub(preferences: Record<string, unknown>): Record<string, Record<string, string>> {
  const rawByClub = getObject(preferences.clubNotificationSeen)
  const normalized: Record<string, Record<string, string>> = {}

  for (const [clubId, rawTabMap] of Object.entries(rawByClub)) {
    const tabMap = getObject(rawTabMap)
    const normalizedTabs: Record<string, string> = {}

    for (const [tab, rawSeenAt] of Object.entries(tabMap)) {
      const parsed = parseSeenAt(rawSeenAt)
      if (parsed) {
        normalizedTabs[tab] = parsed.toISOString()
      }
    }

    if (Object.keys(normalizedTabs).length > 0) {
      normalized[clubId] = normalizedTabs
    }
  }

  return normalized
}

function filterSupportedTabs(tabMap: Record<string, string>): Partial<Record<NotificationTab, string>> {
  const filtered: Partial<Record<NotificationTab, string>> = {}
  for (const [tab, seenAt] of Object.entries(tabMap)) {
    if (!SUPPORTED_TAB_SET.has(tab)) continue
    const parsed = parseSeenAt(seenAt)
    if (!parsed) continue
    filtered[tab as NotificationTab] = parsed.toISOString()
  }
  return filtered
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resolvedParams.clubId,
        },
      },
      select: { id: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })

    const preferences = getObject(user?.preferences)
    const allSeenByClub = getAllSeenByClub(preferences)
    const clubSeen = filterSupportedTabs(allSeenByClub[resolvedParams.clubId] ?? {})

    return NextResponse.json({ seen: clubSeen })
  } catch (error) {
    console.error('Get notification seen timestamps error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resolvedParams.clubId,
        },
      },
      select: { id: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json().catch(() => null) as { tab?: string; seenAt?: string } | null
    const tab = body?.tab?.trim()
    if (!tab || !SUPPORTED_TAB_SET.has(tab)) {
      return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
    }

    const requestedSeenAt = body?.seenAt ? parseSeenAt(body.seenAt) : new Date()
    if (!requestedSeenAt) {
      return NextResponse.json({ error: 'Invalid seenAt timestamp' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })

    const currentPreferences = getObject(user?.preferences)
    const allSeenByClub = getAllSeenByClub(currentPreferences)
    const existingClubSeen = allSeenByClub[resolvedParams.clubId] ?? {}
    const existingSeenAt = parseSeenAt(existingClubSeen[tab])
    const effectiveSeenAt =
      existingSeenAt && existingSeenAt.getTime() > requestedSeenAt.getTime()
        ? existingSeenAt
        : requestedSeenAt

    const updatedAllSeenByClub = {
      ...allSeenByClub,
      [resolvedParams.clubId]: {
        ...existingClubSeen,
        [tab]: effectiveSeenAt.toISOString(),
      },
    }

    const updatedPreferences = {
      ...currentPreferences,
      clubNotificationSeen: updatedAllSeenByClub,
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPreferences as Prisma.InputJsonValue,
      },
      select: { preferences: true },
    })

    const persistedPreferences = getObject(updatedUser.preferences)
    const persistedAllSeenByClub = getAllSeenByClub(persistedPreferences)
    const persistedClubSeen = filterSupportedTabs(persistedAllSeenByClub[resolvedParams.clubId] ?? {})

    return NextResponse.json({
      tab: tab as NotificationTab,
      seenAt: effectiveSeenAt.toISOString(),
      seen: persistedClubSeen,
    })
  } catch (error) {
    console.error('Update notification seen timestamp error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
