import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createInviteCodes } from '@/lib/invite-codes'
import { logActivity } from '@/lib/activity-log'
import { z } from 'zod'
import { Division, Role } from '@prisma/client'

const createClubSchema = z.object({
  name: z.string().min(1).max(100),
  division: z.enum(['B', 'C']),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user exists in database (fix for JWT session strategy)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      // Create the user if they don't exist (shouldn't happen with proper OAuth, but safeguard)
      try {
        await prisma.user.create({
          data: {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.name,
            image: session.user.image,
          },
        })
      } catch (createError) {
        console.error('[Club Create] Error creating user:', createError)
        throw createError
      }
    }

    const body = await req.json()
    const validated = createClubSchema.parse(body)

    // Create invite codes
    const { adminHash, memberHash, adminCode, memberCode, adminEncrypted, memberEncrypted } = await createInviteCodes()

    // Create club and membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          name: validated.name,
          division: validated.division as Division,
          createdById: session.user.id,
          adminInviteCodeHash: adminHash,
          memberInviteCodeHash: memberHash,
          adminInviteCodeEncrypted: adminEncrypted,
          memberInviteCodeEncrypted: memberEncrypted,
        },
      })

      const membership = await tx.membership.create({
        data: {
          userId: session.user.id,
          clubId: club.id,
          role: Role.ADMIN,
        },
      })

      return { club, membership, adminCode, memberCode }
    })

    // Log the club creation
    await logActivity({
      action: 'CLUB_CREATED',
      description: `Club "${result.club.name}" (${result.club.division}) was created`,
      userId: session.user.id,
      metadata: {
        clubId: result.club.id,
        clubName: result.club.name,
        division: result.club.division,
      },
    })

    return NextResponse.json({
      club: result.club,
      inviteCodes: {
        admin: result.adminCode,
        member: result.memberCode,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Create club error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      include: {
        club: true,
        team: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(
      { memberships },
      {
        headers: {
          'Cache-Control': 'private, max-age=30', // Cache for 30 seconds
        },
      }
    )
  } catch (error) {
    console.error('Get clubs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

