import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { BillingClient } from '@/components/billing-client'

export default async function BillingPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login?redirect=/dashboard/billing')
  }

  // Get all user's clubs (any role can purchase boosts)
  const memberships = await prisma.membership.findMany({
    where: { 
      userId: session.user.id,
    },
    include: {
      club: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const clubs = memberships.map(m => m.club)

  // Get user subscription status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      subscriptionStatus: true,
      subscriptionType: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionEndsAt: true,
    },
  })

  // If user has Stripe customer ID but no subscription status, try to sync from Stripe
  if (user?.stripeCustomerId && !user.subscriptionStatus && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = require('stripe')
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      
      // Get customer's subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'all',
        limit: 1,
      })

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0]
        const subscriptionType = subscription.metadata?.type || 'pro'
        
        // Update user subscription status
        const currentPeriodEnd = (subscription as any).current_period_end
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            subscriptionStatus: subscription.status,
            subscriptionType: subscriptionType,
            stripeSubscriptionId: subscription.id,
            subscriptionEndsAt: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : undefined,
          },
        })

        // Re-fetch user with updated subscription status
        const updatedUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            subscriptionStatus: true,
            subscriptionType: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            subscriptionEndsAt: true,
          },
        })
        
        if (updatedUser) {
          Object.assign(user, updatedUser)
        }
      }
    } catch (error) {
      console.error('Error syncing subscription from Stripe:', error)
      // Continue with existing user data if sync fails
    }
  }

  return (
    <BillingClient 
      user={{
        id: user?.id || session.user.id,
        name: user?.name || session.user.name,
        email: user?.email || session.user.email || '',
        image: user?.image || session.user.image,
      }}
      clubs={clubs}
      subscriptionStatus={user?.subscriptionStatus || null}
      subscriptionType={user?.subscriptionType || null}
      subscriptionEndsAt={user?.subscriptionEndsAt || null}
    />
  )
}
