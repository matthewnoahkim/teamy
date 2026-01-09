'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Check, Zap, Crown, CreditCard, ArrowLeft, Loader2, Tag } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'

interface BillingClientProps {
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  clubs: {
    id: string
    name: string
    boostCount: number
  }[]
  subscriptionStatus?: string | null
  subscriptionType?: string | null
  subscriptionEndsAt?: Date | null
  availableBoostBalance: number
}

const proFeatures = [
  'Unlimited clubs',
  'Unlimited AI tokens',
  'Custom backgrounds',
  'Username display customization',
  '5 club boosts included',
]

const boostTiers = [
  { 
    boosts: '0 boosts', 
    tier: 'Tier 1', 
    features: ['50 max members', '5 GB storage'] 
  },
  { 
    boosts: '10 boosts', 
    tier: 'Tier 2', 
    features: [
      '100 max members', 
      '10 GB storage',
      'Admin access to Teamy testing portal',
      'Customizable widgets'
    ] 
  },
  { 
    boosts: '25 boosts', 
    tier: 'Tier 3', 
    features: [
      'Unlimited members', 
      '15 GB storage',
      'Admin access to Teamy testing portal',
      'Customizable widgets',
      '2% discount on designated tournaments',
      '7-day point-in-time data recovery',
      'Dedicated priority support'
    ] 
  },
]

// Stripe Pro Plan Price ID - Get this from Stripe Dashboard after creating the product
// Can be set via environment variable or hardcoded here
const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_1234567890' // TODO: Replace with actual Stripe Price ID

export function BillingClient({ user, clubs, subscriptionStatus, subscriptionType, subscriptionEndsAt, availableBoostBalance }: BillingClientProps) {
  const isPro = subscriptionStatus === 'active' && subscriptionType === 'pro'
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [isRedeemingPromo, setIsRedeemingPromo] = useState(false)
  const [assigningBoostTo, setAssigningBoostTo] = useState<string | null>(null)
  
  // Determine back destination based on where user came from
  const from = searchParams.get('from')
  const backHref = '/dashboard'
  
  // Check for success/cancel messages and verify subscription
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const sessionId = searchParams.get('session_id')
    
    if (success === 'true' && sessionId) {
      // Verify subscription with Stripe
      setIsLoading(true)
      fetch('/api/stripe/verify-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            toast({
              title: 'Payment successful!',
              description: 'Your Pro subscription is now active.',
            })
            // Reload the page to show updated subscription status
            router.refresh()
          } else {
            toast({
              title: 'Payment successful',
              description: 'Your payment was processed. Subscription status will update shortly.',
            })
          }
        })
        .catch((error) => {
          console.error('Error verifying subscription:', error)
          toast({
            title: 'Payment successful',
            description: 'Your payment was processed. Subscription status will update shortly.',
          })
        })
        .finally(() => {
          setIsLoading(false)
          // Clean up URL
          router.replace('/dashboard/billing')
        })
    } else if (success === 'true') {
      toast({
        title: 'Payment successful!',
        description: 'Your Pro subscription is now active.',
      })
      router.refresh()
      router.replace('/dashboard/billing')
    } else if (canceled === 'true') {
      toast({
        title: 'Payment canceled',
        description: 'Your payment was canceled. You can try again anytime.',
        variant: 'destructive',
      })
      // Clean up URL
      router.replace('/dashboard/billing')
    }
  }, [searchParams, router, toast])
  
  const handleUpgradeToPro = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: PRO_PRICE_ID,
          type: 'pro',
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // Show detailed error message if available
        const errorMessage = data.message 
          ? `${data.error}: ${data.message}` 
          : data.error || 'Failed to create checkout session'
        throw new Error(errorMessage)
      }
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start checkout process',
        variant: 'destructive',
      })
      setIsLoading(false)
    }
  }
  
  const handleRedeemPromoCode = async () => {
    if (!promoCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a promo code',
        variant: 'destructive',
      })
      return
    }

    setIsRedeemingPromo(true)
    try {
      const response = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: promoCode.trim() }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to redeem promo code')
      }
      
      toast({
        title: 'Success!',
        description: data.message || 'Promo code redeemed successfully',
      })
      
      // Reset promo code input
      setPromoCode('')
      
      // Refresh the page to show updated subscription status
      router.refresh()
    } catch (error) {
      console.error('Promo redemption error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to redeem promo code',
        variant: 'destructive',
      })
    } finally {
      setIsRedeemingPromo(false)
    }
  }
  
  const handleAssignBoost = async (clubId: string) => {
    if (availableBoostBalance <= 0) {
      toast({
        title: 'Error',
        description: 'No available boosts to assign',
        variant: 'destructive',
      })
      return
    }

    setAssigningBoostTo(clubId)
    try {
      const response = await fetch('/api/club-boosts/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clubId }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign club boost')
      }
      
      toast({
        title: 'Success!',
        description: 'Club boost assigned successfully',
      })
      
      // Refresh the page to show updated boost counts
      router.refresh()
    } catch (error) {
      console.error('Boost assignment error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign club boost',
        variant: 'destructive',
      })
    } finally {
      setAssigningBoostTo(null)
    }
  }
  
  return (
    <div className="min-h-screen bg-background grid-pattern">
      <AppHeader user={user} />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            href={backHref} 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="font-heading text-3xl font-bold text-foreground">Billing & Subscriptions</h1>
          <p className="text-muted-foreground mt-2">Manage your Pro subscription and club boosts</p>
        </div>

        {/* Promo Code */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Have a Promo Code?
            </CardTitle>
            <CardDescription>
              Redeem a promo code to get Pro subscription time or club boosts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRedeemPromoCode()
                  }
                }}
                className="max-w-md"
                disabled={isRedeemingPromo}
              />
              <Button 
                onClick={handleRedeemPromoCode} 
                disabled={isRedeemingPromo || !promoCode.trim()}
              >
                {isRedeemingPromo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redeeming...
                  </>
                ) : (
                  'Redeem'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Plan */}
        <Card className={`mb-8 ${isPro ? 'border-teamy-primary/50 bg-teamy-primary/5' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>
              {isPro ? 'You are currently on the Pro plan' : 'You are currently on the Free plan'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {isPro ? (
                <>
                  <Badge className="text-lg px-4 py-2 bg-teamy-primary text-white">
                    <Crown className="h-4 w-4 mr-1 inline" />
                    Pro
                  </Badge>
                  <span className="text-foreground font-medium">All premium features unlocked</span>
                  {subscriptionEndsAt && (
                    <span className="text-sm text-muted-foreground ml-auto">
                      Renews {new Date(subscriptionEndsAt).toLocaleDateString()}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Badge variant="secondary" className="text-lg px-4 py-2">Free</Badge>
                  <span className="text-muted-foreground">Basic features included</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upgrade to Pro */}
        <Card className="mb-8 border-teamy-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-teamy-primary" />
              Upgrade to Pro
            </CardTitle>
            <CardDescription>Unlock all premium features for just $5/month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-bold text-foreground">$5</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3">
                  {proFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-teamy-primary" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col justify-center">
                {isPro ? (
                  <>
                    <Button 
                      size="lg" 
                      className="w-full bg-teamy-primary hover:bg-teamy-primary-dark text-white"
                      disabled
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Pro Active
                    </Button>
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      Thank you for being a Pro member!
                    </p>
                  </>
                ) : (
                  <>
                    <Button 
                      size="lg" 
                      className="w-full bg-teamy-primary hover:bg-teamy-primary-dark text-white"
                      onClick={handleUpgradeToPro}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting to Stripe...
                        </>
                      ) : (
                        'Upgrade to Pro'
                      )}
                    </Button>
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      Secure payment powered by Stripe
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Club Boosts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-teamy-primary" />
              Club Boosts
            </CardTitle>
            <CardDescription>Upgrade your clubs with boosts at $1 each/month</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Boost Tiers */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {boostTiers.map((tier, index) => (
                <div
                  key={tier.tier}
                  className={`p-4 rounded-xl text-center ${
                    index === 2
                      ? 'bg-teamy-primary/10 border border-teamy-primary/30'
                      : 'bg-muted/50 border border-border'
                  }`}
                >
                  <div className="text-sm text-muted-foreground mb-1">{tier.boosts}</div>
                  <h3 className="font-heading text-lg font-bold mb-2 text-foreground">{tier.tier}</h3>
                  <ul className="space-y-2 text-sm text-left">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-teamy-primary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {clubs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Join a club to assign boosts to it</p>
                <Link href="/dashboard/club">
                  <Button variant="outline">Go to Dashboard</Button>
                </Link>
              </div>
            ) : (
              <>
                {/* Boost Balance */}
                <div className="mb-6 p-4 bg-teamy-primary/10 border border-teamy-primary/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Available Boost Balance</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isPro && 'Includes 5 boosts from Pro subscription'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-teamy-primary">{availableBoostBalance}</div>
                      <div className="text-sm text-muted-foreground">boosts available</div>
                    </div>
                  </div>
                </div>

                {/* Your Clubs */}
                <h3 className="font-semibold mb-4">Your Clubs</h3>
                <div className="space-y-3">
                  {clubs.map((club) => (
                    <div key={club.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{club.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {club.boostCount} {club.boostCount === 1 ? 'boost' : 'boosts'} active this month
                        </p>
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => handleAssignBoost(club.id)}
                        disabled={availableBoostBalance <= 0 || assigningBoostTo === club.id}
                      >
                        {assigningBoostTo === club.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Assigning...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Add Boost
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Club boosts are assigned for the current month and cannot be removed once assigned. 
                    They will automatically expire at the end of the month.
                  </p>
                </div>
              </>
            )}
            <div className="flex flex-col items-center mt-6">
              <Button 
                size="lg" 
                className="w-full max-w-md bg-teamy-primary hover:bg-teamy-primary-dark text-white"
                disabled
              >
                Purchase Additional Boosts
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Coming soon: $1/boost/month
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}