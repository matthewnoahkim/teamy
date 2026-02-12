import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

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

// Stripe webhook secret for verifying webhook signatures
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Disable body parsing for webhook - Stripe needs raw body for signature verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Check if Stripe is configured
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY is not set in environment variables')
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 500 }
    )
  }

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe initialization failed' },
      { status: 500 }
    )
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    )
  }

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set in environment variables')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    // Verify webhook signature
    event = stripe!.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        // Handle subscription creation
        if (session.mode === 'subscription' && session.client_reference_id) {
          const userId = session.client_reference_id
          const subscriptionType = session.metadata?.type || 'pro'
          
          // Update user subscription status in database
          console.log(`Subscription created for user ${userId}, type: ${subscriptionType}`)
          
          // Get subscription details from Stripe
          const subscriptionId = session.subscription as string
          if (subscriptionId && stripe) {
            try {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId)
              
              const updateData: Record<string, unknown> = {
                subscriptionStatus: subscription.status,
                subscriptionType: subscriptionType,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: subscriptionId,
              }

              // Only set subscriptionEndsAt if current_period_end exists and is valid
              const currentPeriodEnd = (subscription as unknown as Record<string, unknown>).current_period_end
              if (currentPeriodEnd && typeof currentPeriodEnd === 'number') {
                updateData.subscriptionEndsAt = new Date(currentPeriodEnd * 1000)
              }
              
              await prisma.user.update({
                where: { id: userId },
                data: updateData,
              })
              
              console.log(`Updated user ${userId} subscription status to ${subscription.status}`)
            } catch (error) {
              console.error('Error updating subscription:', error)
            }
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        // Handle subscription updates (e.g., plan changes, renewals)
        console.log(`Subscription updated: ${subscription.id}`)
        
        // Find user by Stripe customer ID
        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        })
        
        if (user) {
          const updateData: Record<string, unknown> = {
            subscriptionStatus: subscription.status,
          }

          // Only set subscriptionEndsAt if current_period_end exists and is valid
          const currentPeriodEnd = (subscription as unknown as Record<string, unknown>).current_period_end
          if (currentPeriodEnd && typeof currentPeriodEnd === 'number') {
            updateData.subscriptionEndsAt = new Date(currentPeriodEnd * 1000)
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          })
          console.log(`Updated subscription for user ${user.id}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        // Handle subscription cancellation
        console.log(`Subscription canceled: ${subscription.id}`)
        
        // Find user by Stripe customer ID
        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        })
        
        if (user) {
          const updateData: Record<string, unknown> = {
            subscriptionStatus: 'canceled',
          }

          // Only set subscriptionEndsAt if current_period_end exists and is valid
          const currentPeriodEnd = (subscription as unknown as Record<string, unknown>).current_period_end
          if (currentPeriodEnd && typeof currentPeriodEnd === 'number') {
            updateData.subscriptionEndsAt = new Date(currentPeriodEnd * 1000)
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          })
          console.log(`Canceled subscription for user ${user.id}`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Handle successful payment
        console.log(`Payment succeeded for invoice: ${invoice.id}`)
        // TODO: Update subscription status if needed
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // Handle failed payment
        console.log(`Payment failed for invoice: ${invoice.id}`)
        // TODO: Notify user or update subscription status
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

