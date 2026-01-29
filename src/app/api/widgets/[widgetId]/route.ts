import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireMember } from '@/lib/rbac'
import { z } from 'zod'
import { HomeWidgetType, WidgetWidth, WidgetHeight } from '@prisma/client'

const updateWidgetSchema = z.object({
  widgetType: z.nativeEnum(HomeWidgetType).optional(),
  title: z.string().optional(),
  position: z.number().optional(),
  width: z.nativeEnum(WidgetWidth).optional(),
  height: z.nativeEnum(WidgetHeight).optional(),
  isVisible: z.boolean().optional(),
  config: z.any().optional(),
})

// PATCH - Update a widget (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const widgetId = resolvedParams.widgetId
    const body = await req.json()
    const validated = updateWidgetSchema.parse(body)

    // Find the widget and check permissions
    const existingWidget = await prisma.homePageWidget.findUnique({
      where: { id: widgetId },
    })

    if (!existingWidget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
    }

    await requireAdmin(session.user.id, existingWidget.clubId)

    const widget = await prisma.homePageWidget.update({
      where: { id: widgetId },
      data: validated,
    })

    return NextResponse.json({ widget })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid widget data', 
        details: error.issues 
      }, { status: 400 })
    }
    console.error('Update widget error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a widget (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const widgetId = resolvedParams.widgetId

    // Find the widget and check permissions
    const existingWidget = await prisma.homePageWidget.findUnique({
      where: { id: widgetId },
    })

    if (!existingWidget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
    }

    await requireAdmin(session.user.id, existingWidget.clubId)

    await prisma.homePageWidget.delete({
      where: { id: widgetId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete widget error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

