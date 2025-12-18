'use client'

import { useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Zap, Crown, CreditCard, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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
  }[]
}

const proFeatures = [
  'Unlimited clubs',
  'Priority support',
  'Advanced analytics',
  'Custom branding',
  'API access',
  'Early access to new features',
]

const boostTiers = [
  { boosts: '0 boosts', tier: 'Tier 1', features: ['60 max members', '50MB storage/month'] },
  { boosts: '5 boosts', tier: 'Tier 2', features: ['Unlimited members', '100MB storage/month'] },
  { boosts: '10 boosts', tier: 'Tier 3', features: ['Unlimited members', 'Unlimited storage'] },
]

export function BillingClient({ user, clubs }: BillingClientProps) {
  const searchParams = useSearchParams()
  
  // Determine back destination based on where user came from
  const from = searchParams.get('from')
  const backHref = from === 'tournaments' ? '/dashboard/tournaments' : '/dashboard/club'
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern">
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

        {/* Current Plan */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>You are currently on the Free plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-lg px-4 py-2">Free</Badge>
              <span className="text-muted-foreground">Basic features included</span>
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
                <Button 
                  size="lg" 
                  className="w-full bg-teamy-primary hover:bg-teamy-primary-dark text-white"
                  disabled
                >
                  Coming Soon
                </Button>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Payment integration coming soon
                </p>
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
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {tier.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {clubs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Join a club to purchase boosts for it</p>
                <Link href="/dashboard/club">
                  <Button variant="outline">Go to Dashboard</Button>
                </Link>
              </div>
            ) : (
              <>
                {/* Your Clubs */}
                <h3 className="font-semibold mb-4">Your Clubs</h3>
                <div className="space-y-3">
                  {clubs.map((club) => (
                    <div key={club.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{club.name}</p>
                        <p className="text-sm text-muted-foreground">0 boosts active</p>
                      </div>
                      <Button variant="outline" disabled>
                        Add Boosts
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex flex-col items-center mt-6">
              <Button 
                size="lg" 
                className="w-full max-w-md bg-teamy-primary hover:bg-teamy-primary-dark text-white"
                disabled
              >
                Coming Soon
              </Button>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Payment integration coming soon
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

