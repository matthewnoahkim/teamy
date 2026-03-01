import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { decryptInviteCode } from '@/lib/invite-codes'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Single query for auth + code payload to reduce latency on UI actions.
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resolvedParams.clubId,
        },
      },
      select: {
        role: true,
        club: {
          select: {
            adminInviteCodeEncrypted: true,
            memberInviteCodeEncrypted: true,
          },
        },
      },
    })

    if (!membership || membership.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!membership.club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Check if codes need to be regenerated (for existing clubs that were created before encrypted codes)
    const needsRegeneration = membership.club.adminInviteCodeEncrypted === 'NEEDS_REGENERATION'

    if (needsRegeneration) {
      return NextResponse.json({
        needsRegeneration: true,
        message: 'Invite codes need to be regenerated',
      })
    }

    // Decrypt the codes
    const adminCode = decryptInviteCode(membership.club.adminInviteCodeEncrypted)
    const memberCode = decryptInviteCode(membership.club.memberInviteCodeEncrypted)

    return NextResponse.json({
      needsRegeneration: false,
      adminCode,
      memberCode,
    })
  } catch (error) {
    console.error('Get invite codes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
