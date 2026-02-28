import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, LifeBuoy, MessageSquare, Rocket } from 'lucide-react'

const quickLinks = [
  {
    title: 'Product Overview',
    description: 'See how Teamy supports communication, planning, testing, and operations.',
    href: '/features',
    icon: Rocket,
  },
  {
    title: 'Pricing Details',
    description: 'Review plans, limits, and club boost options.',
    href: '/pricing',
    icon: BookOpen,
  },
  {
    title: 'Contact Support',
    description: 'Get help with setup, access, or workflow questions.',
    href: '/contact',
    icon: LifeBuoy,
  },
]

export default function HelpCenterPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <section className="text-center">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">Help Center</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              Start here for common questions and direct support paths.
            </p>
          </section>

          <section className="grid md:grid-cols-3 gap-5">
            {quickLinks.map((item) => (
              <Card key={item.title} className="h-full">
                <CardHeader className="pb-3">
                  <div className="h-10 w-10 rounded-xl bg-teamy-primary/10 border border-teamy-primary/20 flex items-center justify-center mb-2">
                    <item.icon className="h-5 w-5 text-teamy-primary" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  <Link href={item.href}>
                    <Button variant="outline" className="w-full">Open</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </section>

          <section>
            <Card className="border-teamy-primary/20 bg-teamy-primary/5">
              <CardContent className="p-8 md:p-10 text-center">
                <div className="mx-auto mb-4 h-11 w-11 rounded-xl bg-white/70 border border-teamy-primary/20 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-teamy-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">Need direct help?</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                  Send your question with team context and we&apos;ll respond with practical next steps.
                </p>
                <Link href="/contact">
                  <Button size="lg">Send a Message</Button>
                </Link>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  )
}
