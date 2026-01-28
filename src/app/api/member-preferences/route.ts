import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership, isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const updatePreferencesSchema = z.object({
  membershipId: z.string(),
  preferredEvents: z.array(z.string()).optional(),
  avoidEvents: z.array(z.string()).optional(),
  adminNotes: z.string().optional().nullable(),
  strengths: z.string().optional().nullable(),
  weaknesses: z.string().optional().nullable(),
  availability: z.string().optional().nullable(),
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional().nullable(),
})

// GET /api/member-preferences?membershipId=xxx - Get preferences for a member
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const membershipId = searchParams.get('membershipId')

    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 })
    }

    // Get the membership to verify team access
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        preferences: true,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    await requireMember(session.user.id, membership.clubId)

    // Only admins can view other members' preferences
    const currentMembership = await getUserMembership(session.user.id, membership.clubId)
    const isAdminUser = await isAdmin(session.user.id, membership.clubId)

    if (currentMembership?.id !== membershipId && !isAdminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ preferences: membership.preferences })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/member-preferences - Create or update preferences
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = updatePreferencesSchema.parse(body)

    // Get the target membership
    const targetMembership = await prisma.membership.findUnique({
      where: { id: validated.membershipId },
    })

    if (!targetMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    await requireMember(session.user.id, targetMembership.clubId)

    // Only admins can update preferences
    const isAdminUser = await isAdmin(session.user.id, targetMembership.clubId)
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Only admins can update preferences' }, { status: 403 })
    }

    // Upsert preferences
    const preferences = await prisma.memberPreferences.upsert({
      where: { membershipId: validated.membershipId },
      update: {
        preferredEvents: validated.preferredEvents,
        avoidEvents: validated.avoidEvents,
        adminNotes: validated.adminNotes,
        strengths: validated.strengths,
        weaknesses: validated.weaknesses,
        availability: validated.availability,
        experienceLevel: validated.experienceLevel,
      },
      create: {
        membershipId: validated.membershipId,
        preferredEvents: validated.preferredEvents || [],
        avoidEvents: validated.avoidEvents || [],
        adminNotes: validated.adminNotes,
        strengths: validated.strengths,
        weaknesses: validated.weaknesses,
        availability: validated.availability,
        experienceLevel: validated.experienceLevel,
      },
    })

    return NextResponse.json({ preferences })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Update preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

