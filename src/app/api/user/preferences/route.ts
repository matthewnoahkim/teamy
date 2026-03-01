import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getPreferencesObject(preferences: unknown): Record<string, unknown> {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return {}
  }
  return preferences as Record<string, unknown>
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })

    return NextResponse.json({ preferences: user?.preferences || null })
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      backgroundType,
      backgroundColor,
      gradientColors,
      gradientDirection,
      backgroundImageUrl,
      theme,
      primaryClubId,
    } = body

    // Get current preferences and merge with new values (only include defined fields so partial updates don't wipe others)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })

    const currentPreferences = getPreferencesObject(user?.preferences)
    const updatedPreferences = { ...currentPreferences }
    if (backgroundType !== undefined) updatedPreferences.backgroundType = backgroundType
    if (backgroundColor !== undefined) updatedPreferences.backgroundColor = backgroundColor
    if (gradientColors !== undefined) updatedPreferences.gradientColors = gradientColors
    if (gradientDirection !== undefined) updatedPreferences.gradientDirection = gradientDirection
    if (backgroundImageUrl !== undefined) updatedPreferences.backgroundImageUrl = backgroundImageUrl
    if (theme !== undefined) updatedPreferences.theme = theme

    if (primaryClubId !== undefined) {
      if (primaryClubId === null || primaryClubId === '') {
        delete updatedPreferences.primaryClubId
      } else if (typeof primaryClubId === 'string') {
        const normalizedPrimaryClubId = primaryClubId.trim()

        if (!normalizedPrimaryClubId) {
          delete updatedPreferences.primaryClubId
        } else {
          const membership = await prisma.membership.findUnique({
            where: {
              userId_clubId: {
                userId: session.user.id,
                clubId: normalizedPrimaryClubId,
              },
            },
            select: {
              id: true,
            },
          })

          if (!membership) {
            return NextResponse.json(
              { error: 'You can only set a club you are currently in as primary.' },
              { status: 403 }
            )
          }

          updatedPreferences.primaryClubId = normalizedPrimaryClubId
        }
      } else {
        return NextResponse.json({ error: 'Invalid primary club value' }, { status: 400 })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: updatedPreferences as Prisma.InputJsonValue },
      select: { preferences: true },
    })

    return NextResponse.json({ preferences: updatedUser.preferences })
  } catch (error) {
    console.error('Error updating user preferences:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
