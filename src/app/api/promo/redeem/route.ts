import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Promo code is required' },
        { status: 400 }
      )
    }

    const trimmedCode = code.trim().toUpperCase()

    // Find the promo code
    const promoCode = await prisma.promoCode.findUnique({
      where: { code: trimmedCode },
      include: {
        redemptions: {
          where: { userId: session.user.id },
        },
      },
    })

    if (!promoCode) {
      return NextResponse.json(
        { error: 'Invalid promo code' },
        { status: 404 }
      )
    }

    // Check if already redeemed by this user
    if (promoCode.redemptions.length > 0) {
      return NextResponse.json(
        { error: 'You have already redeemed this promo code' },
        { status: 400 }
      )
    }

    // Check if promo code is active
    const now = new Date()
    if (promoCode.activatesAt && promoCode.activatesAt > now) {
      return NextResponse.json(
        { error: 'This promo code is not yet active' },
        { status: 400 }
      )
    }

    // Check if promo code is expired
    if (promoCode.expiresAt && promoCode.expiresAt < now) {
      return NextResponse.json(
        { error: 'This promo code has expired' },
        { status: 400 }
      )
    }

    // Check if max redemptions reached
    if (promoCode.maxRedemptions && promoCode.currentRedemptions >= promoCode.maxRedemptions) {
      return NextResponse.json(
        { error: 'This promo code has reached its maximum number of redemptions' },
        { status: 400 }
      )
    }

    // Calculate expiration date for the redemption
    let redemptionExpiresAt: Date
    if (promoCode.effectType === 'PRO_SUBSCRIPTION') {
      if (!promoCode.effectDuration) {
        return NextResponse.json(
          { error: 'Invalid promo code configuration' },
          { status: 500 }
        )
      }
      // Duration is in weeks
      redemptionExpiresAt = new Date(now.getTime() + promoCode.effectDuration * 7 * 24 * 60 * 60 * 1000)
    } else {
      // CLUB_BOOST - Store quantity, set far future expiration (boosts don't expire by time, only by use)
      if (!promoCode.effectQuantity) {
        return NextResponse.json(
          { error: 'Invalid promo code configuration' },
          { status: 500 }
        )
      }
      // Set expiration far in future for club boosts (they're quantity-based, not time-based)
      redemptionExpiresAt = new Date(now)
      redemptionExpiresAt.setFullYear(redemptionExpiresAt.getFullYear() + 10)
    }

    // Create redemption and update user/promo code in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the redemption record
      const redemption = await tx.promoCodeRedemption.create({
        data: {
          promoCodeId: promoCode.id,
          userId: session.user.id,
          expiresAt: redemptionExpiresAt,
        },
      })

      // Update promo code redemption count with a race-safe max-redemption check.
      if (promoCode.maxRedemptions) {
        const updated = await tx.promoCode.updateMany({
          where: {
            id: promoCode.id,
            currentRedemptions: {
              lt: promoCode.maxRedemptions,
            },
          },
          data: {
            currentRedemptions: {
              increment: 1,
            },
          },
        })

        if (updated.count === 0) {
          throw new Error('PROMO_MAX_REDEMPTIONS_REACHED')
        }
      } else {
        await tx.promoCode.update({
          where: { id: promoCode.id },
          data: {
            currentRedemptions: {
              increment: 1,
            },
          },
        })
      }

      // If PRO_SUBSCRIPTION, update user's subscription
      if (promoCode.effectType === 'PRO_SUBSCRIPTION') {
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { subscriptionEndsAt: true, subscriptionStatus: true },
        })

        let newSubscriptionEndsAt: Date
        if (user?.subscriptionStatus === 'active' && user?.subscriptionEndsAt && user.subscriptionEndsAt > now) {
          // Extend existing subscription
          const currentEndsAt = new Date(user.subscriptionEndsAt)
          newSubscriptionEndsAt = new Date(currentEndsAt.getTime() + promoCode.effectDuration! * 7 * 24 * 60 * 60 * 1000)
        } else {
          // New subscription
          newSubscriptionEndsAt = redemptionExpiresAt
        }

        await tx.user.update({
          where: { id: session.user.id },
          data: {
            subscriptionStatus: 'active',
            subscriptionType: 'pro',
            subscriptionEndsAt: newSubscriptionEndsAt,
          },
        })
      }

      return redemption
    })

    let message = ''
    if (promoCode.effectType === 'PRO_SUBSCRIPTION') {
      const weeks = promoCode.effectDuration!
      message = `Successfully redeemed! You now have ${weeks} week${weeks > 1 ? 's' : ''} of Pro subscription.`
    } else {
      const boosts = promoCode.effectQuantity!
      message = `Successfully redeemed! You received ${boosts} club boost${boosts > 1 ? 's' : ''} to assign to your clubs.`
    }

    return NextResponse.json({
      success: true,
      message,
      redemption: result,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'PROMO_MAX_REDEMPTIONS_REACHED') {
      return NextResponse.json(
        { error: 'This promo code has reached its maximum number of redemptions' },
        { status: 400 }
      )
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'You have already redeemed this promo code' },
        { status: 400 }
      )
    }

    console.error('Error redeeming promo code:', error)
    return NextResponse.json(
      { error: 'Failed to redeem promo code' },
      { status: 500 }
    )
  }
}
