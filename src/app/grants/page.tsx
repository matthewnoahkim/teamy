import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HandHeart, School, Users } from 'lucide-react'

const supportAreas = [
  {
    title: 'Team Access',
    description: 'Support for teams that need help covering core platform costs and onboarding.',
    icon: School,
  },
  {
    title: 'Program Growth',
    description: 'Resources for new clubs building sustainable systems for communication and planning.',
    icon: Users,
  },
  {
    title: 'Operational Relief',
    description: 'Assistance for teams with limited staffing that need tooling to reduce admin overhead.',
    icon: HandHeart,
  },
]

export default function GrantsPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <section className="text-center">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">Grants</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              We are building a grants program to expand access to Teamy for teams with limited resources.
            </p>
          </section>

          <section>
            <Card className="border-teamy-primary/20 bg-teamy-primary/5">
              <CardContent className="p-8 md:p-10">
                <h2 className="text-2xl font-bold text-foreground mb-3">Program status</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Grant applications are not open yet. We are finalizing program criteria and review workflows so
                  awards can be handled consistently and responsibly.
                </p>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-5">What grants are designed to support</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {supportAreas.map((item) => (
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
            </div>
          </section>

          <section className="text-center">
            <Card>
              <CardContent className="p-8 md:p-10">
                <h2 className="text-2xl font-bold text-foreground mb-3">Want updates when grants open?</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Contact us with your team context and we&apos;ll let you know when applications become available.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/contact">
                    <Button size="lg">Contact Teamy</Button>
                  </Link>
                  <Link href="/pricing">
                    <Button size="lg" variant="outline">View Pricing</Button>
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
