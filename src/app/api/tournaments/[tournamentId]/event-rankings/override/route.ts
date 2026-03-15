import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasESAccess } from '@/lib/rbac'

// PATCH /api/tournaments/[tournamentId]/event-rankings/override
// Set or update a manual rank override for a participant
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only TDs can override rankings - use hasESAccess which covers TDs
  const hasAccess = await hasESAccess(session.user.id, session.user.email, tournamentId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await req.json()
  const { testId, membershipId, overrideRank, reason } = body as {
    testId: string
    membershipId: string
    overrideRank: number
    reason?: string
  }

  if (!testId || !membershipId || typeof overrideRank !== 'number') {
    return NextResponse.json({ error: 'testId, membershipId, and overrideRank are required' }, { status: 400 })
  }

  await prisma.tournamentRankingOverride.upsert({
    where: { testId_membershipId: { testId, membershipId } },
    create: { tournamentId, testId, membershipId, overrideRank, reason },
    update: { overrideRank, reason },
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/tournaments/[tournamentId]/event-rankings/override
// Remove a manual rank override
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasAccess = await hasESAccess(session.user.id, session.user.email, tournamentId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const testId = searchParams.get('testId')
  const membershipId = searchParams.get('membershipId')

  if (!testId || !membershipId) {
    return NextResponse.json({ error: 'testId and membershipId query params required' }, { status: 400 })
  }

  await prisma.tournamentRankingOverride.deleteMany({
    where: { testId, membershipId },
  })

  return NextResponse.json({ success: true })
}
