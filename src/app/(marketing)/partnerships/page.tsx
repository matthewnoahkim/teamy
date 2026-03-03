import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, GraduationCap, Megaphone } from 'lucide-react'

const partnerTypes = [
  {
    title: 'Tournament Partners',
    description: 'Collaborate on tournament operations, registration flow, and participant communication.',
    icon: Building2,
  },
  {
    title: 'Education Partners',
    description: 'Co-create resources that support coaches, captains, and program growth.',
    icon: GraduationCap,
  },
  {
    title: 'Community Partners',
    description: 'Help us reach more teams through outreach, events, and shared initiatives.',
    icon: Megaphone,
  },
]

export default function PartnershipsPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <section className="text-center">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">Partnerships</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              We collaborate with organizations that want to improve Science Olympiad team operations at scale.
            </p>
          </section>

          <section className="grid md:grid-cols-3 gap-5">
            {partnerTypes.map((item) => (
              <Card key={item.title}>
                <CardHeader className="pb-3">
                  <div className="h-10 w-10 rounded-xl bg-teamy-primary/10 border border-teamy-primary/20 flex items-center justify-center mb-2">
                    <item.icon className="h-5 w-5 text-teamy-primary" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section>
            <Card className="border-teamy-primary/20 bg-teamy-primary/5">
              <CardContent className="p-8 md:p-10 text-center">
                <h2 className="text-2xl font-bold text-foreground mb-3">Interested in partnering?</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Share your organization and goals, and we&apos;ll follow up with practical collaboration options.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/contact">
                    <Button size="lg">Contact Us</Button>
                  </Link>
                  <Link href="/about">
                    <Button size="lg" variant="outline">Learn About Teamy</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  )
}
