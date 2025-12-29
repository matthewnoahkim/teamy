import { PublicPageLayout } from '@/components/public-page-layout'
import { Check, Zap } from 'lucide-react'
import Link from 'next/link'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/forever',
    features: [
      'Up to 3 clubs',
      '5k AI tokens/month',
      'All core features',
    ],
    cta: 'Get Started',
    ctaLink: '/login',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$5',
    period: '/month',
    features: [
      'Unlimited clubs',
      'Unlimited AI tokens',
      'Custom backgrounds',
      'Username display customization',
      '5 club boosts included',
    ],
    cta: 'Upgrade to Pro',
    ctaLink: '/dashboard/billing',
    highlighted: true,
  },
]

const boostTiers = [
  {
    tier: 'Tier 1',
    boosts: '0 boosts',
    features: ['50 max members', '5 GB storage'],
  },
  {
    tier: 'Tier 2',
    boosts: '10 boosts',
    features: [
      '100 max members', 
      '10 GB storage',
      'Admin access to Teamy testing portal',
      'Customizable widgets'
    ],
  },
  {
    tier: 'Tier 3',
    boosts: '25 boosts',
    features: [
      'Unlimited members', 
      '15 GB storage',
      'Admin access to Teamy testing portal',
      'Customizable widgets',
      '2% discount on designated tournaments',
      '7-day point-in-time data recovery',
      'Dedicated priority support'
    ],
  },
]

export default function PricingPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transparent pricing to keep Teamy running
            </p>
          </div>

          {/* Mission Statement */}
          <div className="text-center mb-12 p-8 rounded-2xl bg-teamy-primary/5 border border-teamy-primary/20">
            <p className="text-lg text-foreground leading-relaxed max-w-3xl mx-auto">
              Teamy costs thousands of dollars and hours yearly to maintain. Even though our goal is{' '}
              <span className="font-semibold">not to make a profit</span>, we offer paid features to help 
              mitigate the costs and keep Teamy accessible for everyone.
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-8 rounded-2xl ${
                  plan.highlighted
                    ? 'bg-teamy-primary/5 border-2 border-teamy-primary shadow-lg'
                    : 'bg-card border border-border shadow-card'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-teamy-primary text-white text-xs font-semibold">
                    Recommended
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="font-heading text-2xl font-bold mb-2 text-foreground">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-foreground">
                      <Check className="h-5 w-5 text-teamy-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={plan.ctaLink}>
                  <button
                    className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
                      plan.highlighted
                        ? 'bg-teamy-primary text-white hover:bg-teamy-primary-dark'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>

          {/* Club Boosts - Single Box */}
          <div className="max-w-4xl mx-auto">
            <div className="p-8 rounded-2xl bg-card border border-border shadow-card">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 mb-2">
                  <Zap className="h-6 w-6 text-teamy-primary" />
                  <h2 className="font-heading text-2xl font-bold text-foreground">Club Boosts</h2>
                </div>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-4xl font-bold text-foreground">$1</span>
                  <span className="text-muted-foreground">each/month</span>
                </div>
                <p className="text-muted-foreground">Upgrade your club&apos;s limits</p>
              </div>

              {/* Tiers Grid */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {boostTiers.map((tier, index) => (
                  <div
                    key={tier.tier}
                    className={`p-5 rounded-xl text-center ${
                      index === 2
                        ? 'bg-teamy-primary/10 border border-teamy-primary/30'
                        : 'bg-muted/50 border border-border'
                    }`}
                  >
                    <div className="text-sm text-muted-foreground mb-1">{tier.boosts}</div>
                    <h3 className="font-heading text-lg font-bold mb-3 text-foreground">{tier.tier}</h3>
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

              {/* Get Boosts Button */}
              <Link href="/dashboard/billing">
                <button className="w-full py-3 rounded-xl font-semibold bg-teamy-primary text-white hover:bg-teamy-primary-dark transition-all duration-300">
                  Get Boosts
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  )
}
