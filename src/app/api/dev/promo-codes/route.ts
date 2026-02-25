import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit-log'
import { devNotFoundResponse, requireDevAccess } from '@/lib/dev/guard'

// GET - List all promo codes
export async function GET(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/promo-codes')
  if (!guard.allowed) return guard.response

  try {
    const promoCodes = await prisma.promoCode.findMany({
      include: {
        redemptions: {
          select: {
            id: true,
            userId: true,
            redeemedAt: true,
            expiresAt: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ promoCodes })
  } catch (error) {
    console.error('Error fetching promo codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo codes' },
      { status: 500 }
    )
  }
}

// POST - Create a new promo code
export async function POST(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/promo-codes')
  if (!guard.allowed) return guard.response

  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email || !session?.user?.id) {
      return devNotFoundResponse(request)
    }

    const { code, effectType, effectDuration, effectQuantity, activatesAt, expiresAt, maxRedemptions } = await request.json()

    // Validation
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      )
    }

    if (!effectType || !['PRO_SUBSCRIPTION', 'CLUB_BOOST'].includes(effectType)) {
      return NextResponse.json(
        { error: 'Invalid effect type' },
        { status: 400 }
      )
    }

    // Validate based on effect type
    if (effectType === 'PRO_SUBSCRIPTION') {
      if (!effectDuration || typeof effectDuration !== 'number' || effectDuration <= 0) {
        return NextResponse.json(
          { error: 'Duration (in weeks) is required for Pro subscription promos' },
          { status: 400 }
        )
      }
    } else if (effectType === 'CLUB_BOOST') {
      if (!effectQuantity || typeof effectQuantity !== 'number' || effectQuantity <= 0) {
        return NextResponse.json(
          { error: 'Quantity (number of boosts) is required for club boost promos' },
          { status: 400 }
        )
      }
    }

    // Check if code already exists
    const existingCode = await prisma.promoCode.findUnique({
      where: { code: code.trim().toUpperCase() },
    })

    if (existingCode) {
      return NextResponse.json(
        { error: 'A promo code with this code already exists' },
        { status: 400 }
      )
    }

    // Create promo code
    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.trim().toUpperCase(),
        effectType,
        effectDuration: effectType === 'PRO_SUBSCRIPTION' ? effectDuration : null,
        effectQuantity: effectType === 'CLUB_BOOST' ? effectQuantity : null,
        activatesAt: activatesAt ? new Date(activatesAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxRedemptions: maxRedemptions || null,
        createdById: session.user.id,
      },
    })

    // Log the action
    await createAuditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'CREATE_PROMO_CODE',
      target: promoCode.code,
      details: {
        effectType: promoCode.effectType,
        effectDuration: promoCode.effectDuration,
        effectQuantity: promoCode.effectQuantity,
        maxRedemptions: promoCode.maxRedemptions,
      },
      request,
    })

    return NextResponse.json({ promoCode }, { status: 201 })
  } catch (error) {
    console.error('Error creating promo code:', error)
    return NextResponse.json(
      { error: 'Failed to create promo code' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a promo code
export async function DELETE(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/promo-codes')
  if (!guard.allowed) return guard.response

  try {
    const session = await getServerSession(authOptions)
    const auditUserId = session?.user?.id ?? 'internal-api-key'
    const auditUserEmail = session?.user?.email ?? 'internal-api-key@local'
    const auditUserName = session?.user?.name ?? 'Internal API Key'

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Promo code ID is required' },
        { status: 400 }
      )
    }

    await prisma.promoCode.delete({
      where: { id },
    })

    // Log the action
    await createAuditLog({
      userId: auditUserId,
      userEmail: auditUserEmail,
      userName: auditUserName,
      action: 'DELETE_PROMO_CODE',
      target: id,
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting promo code:', error)
    return NextResponse.json(
      { error: 'Failed to delete promo code' },
      { status: 500 }
    )
  }
}

// PATCH - Update a promo code
export async function PATCH(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/promo-codes')
  if (!guard.allowed) return guard.response

  try {
    const session = await getServerSession(authOptions)
    const auditUserId = session?.user?.id ?? 'internal-api-key'
    const auditUserEmail = session?.user?.email ?? 'internal-api-key@local'
    const auditUserName = session?.user?.name ?? 'Internal API Key'

    const { id, activatesAt, expiresAt, maxRedemptions } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Promo code ID is required' },
        { status: 400 }
      )
    }

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        activatesAt: activatesAt ? new Date(activatesAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxRedemptions: maxRedemptions || null,
      },
    })

    // Log the action
    await createAuditLog({
      userId: auditUserId,
      userEmail: auditUserEmail,
      userName: auditUserName,
      action: 'UPDATE_PROMO_CODE',
      target: promoCode.code,
      details: {
        activatesAt,
        expiresAt,
        maxRedemptions,
      },
      request,
    })

    return NextResponse.json({ promoCode })
  } catch (error) {
    console.error('Error updating promo code:', error)
    return NextResponse.json(
      { error: 'Failed to update promo code' },
      { status: 500 }
    )
  }
}

