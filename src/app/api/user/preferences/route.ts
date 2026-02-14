import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const { backgroundType, backgroundColor, gradientColors, gradientDirection, backgroundImageUrl, theme } = body

    // Get current preferences and merge with new values (only include defined fields so partial updates don't wipe others)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })

    const currentPreferences = (user?.preferences as Record<string, unknown>) || {}
    const updatedPreferences = { ...currentPreferences }
    if (backgroundType !== undefined) updatedPreferences.backgroundType = backgroundType
    if (backgroundColor !== undefined) updatedPreferences.backgroundColor = backgroundColor
    if (gradientColors !== undefined) updatedPreferences.gradientColors = gradientColors
    if (gradientDirection !== undefined) updatedPreferences.gradientDirection = gradientDirection
    if (backgroundImageUrl !== undefined) updatedPreferences.backgroundImageUrl = backgroundImageUrl
    if (theme !== undefined) updatedPreferences.theme = theme

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: updatedPreferences },
      select: { preferences: true },
    })

    return NextResponse.json({ preferences: updatedUser.preferences })
  } catch (error) {
    console.error('Error updating user preferences:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}

