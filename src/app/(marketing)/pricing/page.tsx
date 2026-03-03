import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { Check, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    summary: 'For teams getting started with core operations.',
    features: ['Up to 3 clubs', '5k AI tokens/month', 'Core team management features'],
    cta: 'Get Started',
    ctaLink: '/signup',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$5',
    period: '/month',
    summary: 'For active teams that need higher limits and more customization.',
    features: [
      'Unlimited clubs',
      'Unlimited AI tokens',
      'Custom backgrounds and profile customization',
      '5 club boosts included',
    ],
    cta: 'Manage Plan',
    ctaLink: '/billing',
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
    features: ['100 max members', '10 GB storage', 'Admin access to Teamy testing portal', 'Custom widgets'],
  },
  {
    tier: 'Tier 3',
    boosts: '25 boosts',
    features: [
      'Unlimited members',
      '15 GB storage',
      'Admin access to Teamy testing portal',
      'Custom widgets',
      '2% discount on designated tournaments',
      '7-day point-in-time data recovery',
      'Priority support',
    ],
  },
]

const faqs = [
  {
    question: 'Can we start on Free and upgrade later?',
    answer: 'Yes. Teams can move from Free to Pro at any time without rebuilding data.',
  },
  {
    question: 'How do club boosts work?',
    answer: 'Boosts add capacity for a club. You can assign boosts where your team needs them most.',
  },
  {
    question: 'Do you offer discounts for school programs?',
    answer: 'If cost is a blocker, contact us. We are building support options for teams with limited resources.',
  },
]

export default function PricingPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-10">
          <section className="text-center">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">Pricing</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              Clear pricing that keeps Teamy sustainable while staying accessible to teams of different sizes.
            </p>
          </section>

          <Card className="border-teamy-primary/20 bg-teamy-primary/5">
            <CardContent className="p-7 md:p-8 text-center">
              <p className="text-foreground leading-relaxed max-w-4xl mx-auto">
                Teamy is built to support Science Olympiad programs long-term. Paid features help cover infrastructure,
                AI usage, and ongoing product development while the core experience remains available.
              </p>
            </CardContent>
          </Card>

          <section className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.highlighted ? 'border-teamy-primary/50 shadow-lg' : ''}
              >
                <CardContent className="p-7 md:p-8 h-full flex flex-col">
                  <div className="mb-5">
                    {plan.highlighted && (
                      <span className="inline-block mb-3 rounded-full bg-teamy-primary text-white text-xs font-semibold px-3 py-1">
                        Most Popular
                      </span>
                    )}
                    <h2 className="font-heading text-2xl font-bold text-foreground">{plan.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{plan.summary}</p>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-teamy-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.ctaLink}>
                    <Button className="w-full" variant={plan.highlighted ? 'default' : 'outline'}>
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </section>

          <section>
            <Card>
              <CardContent className="p-7 md:p-8">
                <div className="text-center mb-7">
                  <div className="inline-flex items-center gap-2">
                    <Zap className="h-5 w-5 text-teamy-primary" />
                    <h2 className="font-heading text-2xl font-bold text-foreground">Club Boosts</h2>
                  </div>
                  <p className="text-muted-foreground mt-2">$1 per boost / month</p>
                </div>

                <div className="grid md:grid-cols-3 gap-5">
                  {boostTiers.map((tier) => (
                    <div key={tier.tier} className="rounded-xl border border-border bg-muted/40 p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tier.boosts}</p>
                      <h3 className="font-semibold text-foreground mt-1 mb-3">{tier.tier}</h3>
                      <ul className="space-y-2">
                        {tier.features.map((feature) => (
                          <li key={feature} className="text-sm text-foreground flex items-start gap-2">
                            <Check className="h-4 w-4 text-teamy-primary mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">Pricing FAQ</h2>
            <div className="space-y-3">
              {faqs.map((item) => (
                <details key={item.question} className="group rounded-xl border border-border bg-card p-5 open:border-teamy-primary/30">
                  <summary className="cursor-pointer list-none font-semibold text-foreground flex items-center justify-between">
                    <span>{item.question}</span>
                    <span className="text-xs text-muted-foreground group-open:hidden">Expand</span>
                    <span className="text-xs text-muted-foreground hidden group-open:inline">Collapse</span>
                  </summary>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  )
}
