import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

// Initialize Stripe with secret key (server-side only)
// Never expose this key to the client - it's only used server-side
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

let stripe: Stripe | null = null
if (stripeSecretKey) {
  try {
    stripe = new Stripe(stripeSecretKey)
  } catch (error) {
    console.error('Failed to initialize Stripe:', error)
  }
}

const PRO_PRICE_IDS = [
  process.env.STRIPE_PRO_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
].filter((value): value is string => !!value && value.trim().length > 0)

const PRICE_ID_TO_TYPE = new Map<string, 'pro'>(
  PRO_PRICE_IDS.map((priceId) => [priceId.trim(), 'pro'])
)

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'Stripe is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe initialization failed. Please contact support.' },
        { status: 500 }
      )
    }

    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { priceId } = body

    if (typeof priceId !== 'string' || priceId.trim().length === 0) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
    }

    if (PRICE_ID_TO_TYPE.size === 0) {
      return NextResponse.json(
        { error: 'No valid subscription price IDs are configured on the server.' },
        { status: 500 }
      )
    }

    const normalizedPriceId = priceId.trim()
    const subscriptionType = PRICE_ID_TO_TYPE.get(normalizedPriceId)
    if (!subscriptionType) {
      return NextResponse.json(
        { error: 'Invalid pricing option selected.' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    // First, check if user already has a Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })

    let customerId = user?.stripeCustomerId

    // If no customer ID exists, create one in Stripe
    if (!customerId) {
      const customer = await stripe!.customers.create({
        email: session.user.email || undefined,
        metadata: {
          userId: session.user.id,
        },
      })
      customerId = customer.id

      // Save customer ID to database immediately
      await prisma.user.update({
        where: { id: session.user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    // Get the base URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (req.headers.get('origin') || `https://${req.headers.get('host')}`)

    // Create checkout session with customer ID
    const checkoutSession = await stripe!.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId, // Use customer ID instead of customer_email
      line_items: [
        {
          price: normalizedPriceId,
          quantity: 1,
        },
      ],
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        type: subscriptionType,
      },
      success_url: `${baseUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/billing?canceled=true`,
    })

    return NextResponse.json({ 
      sessionId: checkoutSession.id,
      url: checkoutSession.url 
    })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    
    // Handle Stripe-specific errors without leaking internal details
    if (error && typeof error === 'object') {
      const err = error as { type?: string; message?: string; code?: string }
      
      if (err.code === 'resource_missing' || err.message?.includes('No such price')) {
        return NextResponse.json(
          { error: 'Invalid pricing configuration. Please contact support.' },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

