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
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { code } = joinSchema.parse(body)

    // Find all clubs and check which one this code belongs to
    const clubs = await prisma.club.findMany()
    
    let matchedClub: typeof clubs[0] | null = null
    let role: Role | null = null

    for (const club of clubs) {
      const isAdminCode = await verifyInviteCode(code, club.adminInviteCodeHash)
      if (isAdminCode) {
        matchedClub = club
        role = Role.ADMIN
        break
      }

      const isMemberCode = await verifyInviteCode(code, club.memberInviteCodeHash)
      if (isMemberCode) {
        matchedClub = club
        role = Role.MEMBER
        break
      }
    }

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

