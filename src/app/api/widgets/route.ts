import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireMember } from '@/lib/rbac'
import { z } from 'zod'
import { HomeWidgetType, WidgetWidth, WidgetHeight } from '@prisma/client'

const createWidgetSchema = z.object({
  clubId: z.string(),
  widgetType: z.nativeEnum(HomeWidgetType),
  title: z.string().optional(),
  position: z.number().optional(),
  width: z.nativeEnum(WidgetWidth).optional(),
  height: z.nativeEnum(WidgetHeight).optional(),
  isVisible: z.boolean().optional(),
  config: z.any().optional(),
})

// GET - Get all widgets for a club
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    await requireMember(session.user.id, clubId)

    const widgets = await prisma.homePageWidget.findMany({
      where: { clubId },
      orderBy: { position: 'asc' },
    })

    return NextResponse.json({ widgets })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get widgets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new widget (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = createWidgetSchema.parse(body)

    await requireAdmin(session.user.id, validated.clubId)

    const widget = await prisma.homePageWidget.create({
      data: {
        clubId: validated.clubId,
        ownerId: session.user.id,
        widgetType: validated.widgetType,
        title: validated.title,
        position: validated.position ?? 0,
        width: validated.width ?? 'MEDIUM',
        height: validated.height ?? 'MEDIUM',
        isVisible: validated.isVisible ?? true,
        config: validated.config,
      },
    })

    return NextResponse.json({ widget })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid widget data', 
        details: error.issues 
      }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Create widget error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
