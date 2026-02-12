import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit-log'

// Helper function to check dev panel access
async function checkDevAccess(email?: string | null) {
  if (!email) return false

  // Check database whitelist
  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'dev_panel_email_whitelist' },
  })

  if (setting) {
    try {
      const emails = JSON.parse(setting.value)
      if (Array.isArray(emails) && emails.map((e: string) => e.toLowerCase()).includes(email.toLowerCase())) {
        return true
      }
    } catch (e) {
      console.error('Failed to parse email whitelist:', e)
    }
  }

  // Fallback to environment variable
  const defaultEmails = process.env.DEV_PANEL_DEFAULT_EMAILS
  if (defaultEmails) {
    const emailList = defaultEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
    return emailList.includes(email.toLowerCase())
  }

  return false
}

// GET - List all promo codes
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await checkDevAccess(session.user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await checkDevAccess(session.user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await checkDevAccess(session.user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
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
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await checkDevAccess(session.user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
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

