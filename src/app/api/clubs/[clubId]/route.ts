import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, requireAdmin } from '@/lib/rbac'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const updateClubSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  backgroundType: z.enum(['grid', 'solid', 'gradient', 'image']).optional(),
  backgroundColor: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.null()]).optional(),
  gradientStartColor: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.null()]).optional(),
  gradientEndColor: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.null()]).optional(),
  backgroundImageUrl: z.union([z.string().url(), z.string().startsWith('/'), z.null()]).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await requireMember(session.user.id, resolvedParams.clubId)

    const club = await prisma.club.findUnique({
      where: { id: resolvedParams.clubId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            team: true,
            rosterAssignments: {
              include: {
                event: true,
              },
            },
          },
        },
        teams: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    return NextResponse.json({ club })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get club error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can update clubs
    await requireAdmin(session.user.id, resolvedParams.clubId)

    const body = await req.json()
    const validatedData = updateClubSchema.parse(body)

    // Verify club exists
    const existingClub = await prisma.club.findUnique({
      where: { id: resolvedParams.clubId },
    })

    if (!existingClub) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Build update data object
    const updateData: any = {}
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name
    }
    if (validatedData.backgroundType !== undefined) {
      updateData.backgroundType = validatedData.backgroundType
    }
    if (validatedData.backgroundColor !== undefined) {
      updateData.backgroundColor = validatedData.backgroundColor
    }
    if (validatedData.gradientStartColor !== undefined) {
      updateData.gradientStartColor = validatedData.gradientStartColor
    }
    if (validatedData.gradientEndColor !== undefined) {
      updateData.gradientEndColor = validatedData.gradientEndColor
    }
    if (validatedData.backgroundImageUrl !== undefined) {
      updateData.backgroundImageUrl = validatedData.backgroundImageUrl
    }

    // Update club
    const updatedClub = await prisma.club.update({
      where: { id: resolvedParams.clubId },
      data: updateData,
    })

    // Ensure club pages show the new background immediately
    revalidatePath(`/club/${resolvedParams.clubId}`)

    return NextResponse.json({ club: updatedClub })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues)
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.issues 
      }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Update club error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can delete clubs
    await requireAdmin(session.user.id, resolvedParams.clubId)

    // Verify club exists
    const club = await prisma.club.findUnique({
      where: { id: resolvedParams.clubId },
    })

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Delete club (cascading deletes will handle related records)
    await prisma.club.delete({
      where: { id: resolvedParams.clubId },
    })

    // Revalidate dashboard to refresh the memberships list
    revalidatePath('/dashboard/club')
    revalidatePath('/dashboard')

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Delete club error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

