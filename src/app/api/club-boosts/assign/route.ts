import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Assign a boost to a club
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { clubId } = await request.json()

    if (!clubId) {
      return NextResponse.json(
        { error: 'Club ID is required' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Check if user is a member of the club
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        clubId,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a member of this club to assign boosts' },
        { status: 403 }
      )
    }

    // Calculate available boosts
    const promoBoostRedemptions = await prisma.promoCodeRedemption.findMany({
      where: {
        userId: session.user.id,
        expiresAt: {
          gt: now,
        },
        promoCode: {
          effectType: 'CLUB_BOOST',
        },
      },
      include: {
        promoCode: true,
      },
    })

    const totalPromoBoosts = promoBoostRedemptions.reduce((sum, redemption) => {
      return sum + (redemption.promoCode.effectQuantity || 0)
    }, 0)

    // Get Pro subscription boosts (5 included)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionStatus: true,
        subscriptionType: true,
      },
    })

    const isPro = user?.subscriptionStatus === 'active' && user?.subscriptionType === 'pro'
    const proSubscriptionBoosts = isPro ? 5 : 0

    const totalBoosts = totalPromoBoosts + proSubscriptionBoosts

    // Get currently assigned boosts
    const assignedBoosts = await prisma.clubBoost.count({
      where: {
        userId: session.user.id,
        expiresAt: {
          gt: now,
        },
      },
    })

    if (assignedBoosts >= totalBoosts) {
      return NextResponse.json(
        { error: 'No available boosts to assign' },
        { status: 400 }
      )
    }

    // Calculate expiration date (end of current month)
    const expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Determine source type and ID
    let sourceType = 'PRO_SUBSCRIPTION'
    let sourceId: string | null = null

    const promoRedemptionIds = promoBoostRedemptions.map((redemption) => redemption.id)
    const promoUsageByRedemption = promoRedemptionIds.length > 0
      ? await prisma.clubBoost.groupBy({
          by: ['sourceId'],
          where: {
            userId: session.user.id,
            sourceType: 'PROMO',
            expiresAt: {
              gt: now,
            },
            sourceId: {
              in: promoRedemptionIds,
            },
          },
          _count: {
            _all: true,
          },
        })
      : []

    const promoUsageMap = new Map(
      promoUsageByRedemption
        .map((entry) => [entry.sourceId, entry._count._all] as const)
        .filter((entry): entry is [string, number] => entry[0] !== null),
    )

    const promoRedemptionWithCapacity = promoBoostRedemptions.find((redemption) => {
      const totalFromRedemption = redemption.promoCode.effectQuantity || 0
      const usedFromRedemption = promoUsageMap.get(redemption.id) || 0
      return usedFromRedemption < totalFromRedemption
    })

    // If user has Pro subscription, use those boosts first
    if (isPro) {
      const proBoostsUsed = await prisma.clubBoost.count({
        where: {
          userId: session.user.id,
          sourceType: 'PRO_SUBSCRIPTION',
          expiresAt: {
            gt: now,
          },
        },
      })

      if (proBoostsUsed < 5) {
        sourceType = 'PRO_SUBSCRIPTION'
      } else if (promoRedemptionWithCapacity) {
        sourceType = 'PROMO'
        sourceId = promoRedemptionWithCapacity.id
      }
    } else if (promoRedemptionWithCapacity) {
      sourceType = 'PROMO'
      sourceId = promoRedemptionWithCapacity.id
    } else {
      return NextResponse.json(
        { error: 'No available boosts to assign' },
        { status: 400 }
      )
    }

    // Create the club boost assignment
    const clubBoost = await prisma.clubBoost.create({
      data: {
        userId: session.user.id,
        clubId,
        expiresAt,
        sourceType,
        sourceId,
      },
    })

    return NextResponse.json({
      success: true,
      clubBoost,
    })
  } catch (error) {
    console.error('Error assigning club boost:', error)
    return NextResponse.json(
      { error: 'Failed to assign club boost' },
      { status: 500 }
    )
  }
}
