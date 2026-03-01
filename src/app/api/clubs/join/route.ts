import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyInviteCode } from '@/lib/invite-codes'
import { logActivity } from '@/lib/activity-log'
import { z } from 'zod'
import { Role } from '@prisma/client'

const joinSchema = z.object({
  code: z.string().min(1),
  clubId: z.string().min(1).optional(),
})

const previewSchema = z.object({
  code: z.string().min(1),
  clubId: z.string().min(1).optional(),
})

async function resolveInviteCodeForClub(code: string, clubId: string) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      id: true,
      name: true,
      adminInviteCodeHash: true,
      memberInviteCodeHash: true,
    },
  })

  if (!club) {
    return null
  }

  const isAdminCode = await verifyInviteCode(code, club.adminInviteCodeHash)
  if (isAdminCode) {
    return { club, role: Role.ADMIN }
  }

  const isMemberCode = await verifyInviteCode(code, club.memberInviteCodeHash)
  if (isMemberCode) {
    return { club, role: Role.MEMBER }
  }

  return null
}

async function resolveInviteCode(code: string, clubId?: string) {
  if (clubId) {
    const directMatch = await resolveInviteCodeForClub(code, clubId)
    if (directMatch) {
      return directMatch
    }
  }

  const clubs = await prisma.club.findMany({
    select: {
      id: true,
      name: true,
      adminInviteCodeHash: true,
      memberInviteCodeHash: true,
    },
  })

  for (const club of clubs) {
    const isAdminCode = await verifyInviteCode(code, club.adminInviteCodeHash)
    if (isAdminCode) {
      return { club, role: Role.ADMIN }
    }

    const isMemberCode = await verifyInviteCode(code, club.memberInviteCodeHash)
    if (isMemberCode) {
      return { club, role: Role.MEMBER }
    }
  }

  return null
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const parsed = previewSchema.safeParse({
      code: searchParams.get('code') ?? '',
      clubId: searchParams.get('clubId') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
    }

    const resolved = await resolveInviteCode(parsed.data.code, parsed.data.clubId)
    if (!resolved) {
      return NextResponse.json(
        { error: 'Invalid or expired invite code', code: 'INVALID_CODE' },
        { status: 404 }
      )
    }

    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resolved.club.id,
        },
      },
      select: { id: true },
    })

    return NextResponse.json({
      club: {
        id: resolved.club.id,
        name: resolved.club.name,
      },
      role: resolved.role,
      alreadyMember: Boolean(existingMembership),
    })
  } catch (error) {
    console.error('Join invite preview error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { code, clubId } = joinSchema.parse(body)

    const resolvedInvite = await resolveInviteCode(code, clubId)
    const matchedClub = resolvedInvite?.club ?? null
    const role = resolvedInvite?.role ?? null

    if (!matchedClub || !role) {
      return NextResponse.json(
        { error: 'Invalid or expired invite code', code: 'INVALID_CODE' },
        { status: 401 }
      )
    }

    // Verify the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User account not found. Please sign out and sign in again.', code: 'USER_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const existing = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: matchedClub.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'You are already a member of this club', code: 'ALREADY_MEMBER' },
        { status: 400 }
      )
    }

    // Create membership
    const membership = await prisma.membership.create({
      data: {
        userId: session.user.id,
        clubId: matchedClub.id,
        role,
      },
      include: {
        club: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    // Log the club join
    await logActivity({
      action: 'USER_JOINED_CLUB',
      description: `${membership.user.name || membership.user.email} joined club "${matchedClub.name}" as ${role}`,
      userId: session.user.id,
      metadata: {
        clubId: matchedClub.id,
        clubName: matchedClub.name,
        role,
        membershipId: membership.id,
      },
    })

    return NextResponse.json({
      membership,
      message: `Successfully joined club as ${role.toLowerCase()}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    
    // Handle Prisma foreign key constraint violations
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
      const prismaError = error as { code: string; meta?: { field_name?: string } }
      if (prismaError.meta?.field_name?.includes('userId')) {
        return NextResponse.json(
          { 
            error: 'User account not found. Please sign out and sign in again.', 
            code: 'USER_NOT_FOUND' 
          },
          { status: 404 }
        )
      }
      if (prismaError.meta?.field_name?.includes('clubId')) {
        return NextResponse.json(
          { 
            error: 'Club not found.', 
            code: 'CLUB_NOT_FOUND' 
          },
          { status: 404 }
        )
      }
    }
    
    console.error('Join club error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
