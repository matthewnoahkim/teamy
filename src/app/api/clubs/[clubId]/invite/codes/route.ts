import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'
import { decryptInviteCode } from '@/lib/invite-codes'

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

    await requireAdmin(session.user.id, resolvedParams.clubId)

    const club = await prisma.club.findUnique({
      where: { id: resolvedParams.clubId },
      select: {
        adminInviteCodeEncrypted: true,
        memberInviteCodeEncrypted: true,
      },
    })

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Check if codes need to be regenerated (for existing clubs that were created before encrypted codes)
    const needsRegeneration = club.adminInviteCodeEncrypted === 'NEEDS_REGENERATION'

    if (needsRegeneration) {
      return NextResponse.json({
        needsRegeneration: true,
        message: 'Invite codes need to be regenerated',
      })
    }

    // Decrypt the codes
    const adminCode = decryptInviteCode(club.adminInviteCodeEncrypted)
    const memberCode = decryptInviteCode(club.memberInviteCodeEncrypted)

    return NextResponse.json({
      needsRegeneration: false,
      adminCode,
      memberCode,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get invite codes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

