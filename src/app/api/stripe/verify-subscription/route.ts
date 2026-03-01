import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getConfiguredAppOrigins, isTrustedOrigin } from '@/lib/url-safety'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

let stripe: Stripe | null = null
if (stripeSecretKey) {
  try {
    stripe = new Stripe(stripeSecretKey)
  } catch (error) {
    console.error('Failed to initialize Stripe:', error)
  }
}

type CheckoutSessionOwnershipInput = Pick<
  Stripe.Checkout.Session,
  'client_reference_id' | 'metadata' | 'customer'
>

type CheckoutSessionOwnershipContext = {
  userId: string
  userStripeCustomerId?: string | null
}

function getCheckoutCustomerId(checkoutSession: CheckoutSessionOwnershipInput): string | null {
  return typeof checkoutSession.customer === 'string'
    ? checkoutSession.customer
    : checkoutSession.customer?.id ?? null
}

export function isCheckoutSessionOwnedByUser(
  checkoutSession: CheckoutSessionOwnershipInput,
  context: CheckoutSessionOwnershipContext
): boolean {
  if (checkoutSession.client_reference_id === context.userId) {
    return true
  }

  if (checkoutSession.metadata?.userId === context.userId) {
    return true
  }

  const checkoutCustomerId = getCheckoutCustomerId(checkoutSession)
  if (
    checkoutCustomerId &&
    context.userStripeCustomerId &&
    checkoutCustomerId === context.userStripeCustomerId
  ) {
    return true
  }

  return false
}

// POST /api/stripe/verify-subscription
// Verifies and updates subscription status from Stripe
export async function POST(req: NextRequest) {
  try {
    if (!stripeSecretKey || !stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isTrustedOrigin(req.headers.get('origin'), getConfiguredAppOrigins())) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
    }

    const body = await req.json()
    const { sessionId, refresh } = body

    let subscription: Stripe.Subscription
    let subscriptionType = 'pro'

    if (refresh) {
      // Refresh mode: get subscription from user's Stripe customer ID or email
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          email: true,
        },
      })

      console.log('Refresh subscription - User:', { 
        userId: session.user.id, 
        hasStripeCustomerId: !!user?.stripeCustomerId 
      })

      let subscriptions: Stripe.Subscription[] = []

      if (user?.stripeCustomerId) {
        // Try to get subscriptions by customer ID
        try {
          const customerSubscriptions = await stripe.subscriptions.list({
            customer: user.stripeCustomerId,
            status: 'all',
            limit: 10,
          })
          subscriptions = customerSubscriptions.data
          console.log(`Found ${subscriptions.length} subscriptions for customer ${user.stripeCustomerId}`)
        } catch (error) {
          console.error('Error fetching subscriptions by customer ID:', error)
        }
      }

      // If no subscriptions found by customer ID, try searching by email
      if (subscriptions.length === 0 && user?.email) {
        console.log('No subscriptions found by customer ID, searching by email')
        try {
          // Search for customers by email
          const customers = await stripe.customers.list({
            email: user.email,
            limit: 10,
          })
          console.log(`Found ${customers.data.length} customers matching user`)

          // Check subscriptions for each customer found
          for (const customer of customers.data) {
            try {
              const customerSubscriptions = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'all',
                limit: 10,
              })
              subscriptions.push(...customerSubscriptions.data)
              console.log(`Found ${customerSubscriptions.data.length} subscriptions for customer ${customer.id}`)

              // Update user's customer ID if we found one
              if (!user.stripeCustomerId && customer.id) {
                await prisma.user.update({
                  where: { id: session.user.id },
                  data: { stripeCustomerId: customer.id },
                })
                console.log(`Updated user ${session.user.id} with customer ID ${customer.id}`)
              }
            } catch (error) {
              console.error(`Error fetching subscriptions for customer ${customer.id}:`, error)
            }
          }
        } catch (error) {
          console.error('Error searching customers by email:', error)
        }
      }

      if (subscriptions.length === 0) {
        console.log('No subscriptions found after all search attempts')
        return NextResponse.json(
          { 
            error: 'No subscription found. Please complete a subscription first.',
          },
          { status: 404 }
        )
      }

      // Get the most recent active subscription, or the most recent one
      subscription = subscriptions.find((s) => s.status === 'active') || subscriptions[0]
      subscriptionType = subscription.metadata?.type || 'pro'
      console.log(`Selected subscription: ${subscription.id}, status: ${subscription.status}, type: ${subscriptionType}`)
    } else {
      // Normal mode: verify from checkout session
      if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
        return NextResponse.json(
          { error: 'Session ID is required' },
          { status: 400 }
        )
      }

      const normalizedSessionId = sessionId.trim()
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { stripeCustomerId: true },
      })

      // Retrieve the checkout session from Stripe
      const checkoutSession = await stripe.checkout.sessions.retrieve(normalizedSessionId, {
        expand: ['subscription', 'customer'],
      })

      console.log('Checkout session retrieved:', {
        id: checkoutSession.id,
        customer: checkoutSession.customer,
        subscription: checkoutSession.subscription,
        client_reference_id: checkoutSession.client_reference_id,
      })

      if (!checkoutSession.subscription) {
        return NextResponse.json(
          { error: 'No subscription found for this session' },
          { status: 400 }
        )
      }

      if (checkoutSession.status !== 'complete') {
        return NextResponse.json(
          { error: 'Checkout session is not complete yet' },
          { status: 400 }
        )
      }

      const ownsSession = isCheckoutSessionOwnedByUser(checkoutSession, {
        userId: session.user.id,
        userStripeCustomerId: currentUser?.stripeCustomerId,
      })

      if (!ownsSession) {
        return NextResponse.json(
          { error: 'Checkout session does not belong to this account' },
          { status: 403 }
        )
      }

      // Get customer ID from checkout session
      const checkoutCustomerId = getCheckoutCustomerId(checkoutSession)

      // Save customer ID if we don't have it
      if (checkoutCustomerId && !currentUser?.stripeCustomerId) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { stripeCustomerId: checkoutCustomerId },
        })
        console.log(`Saved customer ID ${checkoutCustomerId} for user ${session.user.id}`)
      }

      // Get subscription details
      const subscriptionId =
        typeof checkoutSession.subscription === 'string'
          ? checkoutSession.subscription
          : checkoutSession.subscription.id

      subscription = await stripe.subscriptions.retrieve(subscriptionId)
      subscriptionType = checkoutSession.metadata?.type || 'pro'
      
      console.log(`Retrieved subscription ${subscriptionId}, status: ${subscription.status}`)
    }

    // Get customer ID (can be string or expanded Customer object)
    const customerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer?.id || null

    if (!customerId) {
      console.error('No customer ID found in subscription:', subscription.id)
      return NextResponse.json(
        { error: 'Invalid subscription: no customer ID' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      subscriptionStatus: subscription.status,
      subscriptionType: subscriptionType,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
    }

    // Only set subscriptionEndsAt if current_period_end exists and is valid
    const currentPeriodEnd = (subscription as unknown as Record<string, unknown>).current_period_end
    if (currentPeriodEnd && typeof currentPeriodEnd === 'number') {
      updateData.subscriptionEndsAt = new Date(currentPeriodEnd * 1000)
      console.log(`Setting subscriptionEndsAt to: ${(updateData.subscriptionEndsAt as Date).toISOString()}`)
    } else {
      console.warn(`Subscription ${subscription.id} has invalid current_period_end:`, currentPeriodEnd)
    }

    // Update user subscription status
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
      })
      console.log(`Successfully updated user ${session.user.id} subscription status to ${subscription.status}`)
    } catch (dbError) {
      console.error('Database update error:', dbError)
      throw dbError
    }

    return NextResponse.json({
      success: true,
      subscriptionStatus: subscription.status,
      subscriptionType: subscriptionType,
      customerId: customerId,
      subscriptionId: subscription.id,
    })
  } catch (error) {
    console.error('Verify subscription error:', error)
    
    return NextResponse.json(
      { error: 'Failed to verify subscription' },
      { status: 500 }
    )
  }
}
