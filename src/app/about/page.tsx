import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Compass, Users, Wrench } from 'lucide-react'

export const metadata = {
  title: 'About | Teamy',
  description: 'Why Teamy exists and what we are building for Science Olympiad teams.',
}

const principles = [
  {
    title: 'Practical First',
    description: 'Every feature should solve real team workflow problems, not add admin overhead.',
    icon: Wrench,
  },
  {
    title: 'Accessible by Default',
    description: 'Strong organization tools should be usable by both established and brand-new programs.',
    icon: Compass,
  },
  {
    title: 'Built with Users',
    description: 'We prioritize feedback from coaches, captains, and tournament staff who use Teamy daily.',
    icon: Users,
  },
]

const timeline = [
  {
    label: 'Pain Point',
    text: 'Team operations were spread across chats, docs, and spreadsheets.',
  },
  {
    label: 'Build',
    text: 'We unified communication, planning, and test workflows in one platform.',
  },
  {
    label: 'Today',
    text: 'Teamy keeps evolving with direct feedback from active Science Olympiad communities.',
  },
]

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <section className="text-center space-y-4">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">About Teamy</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Teamy is an operations platform built for Science Olympiad teams that need clear systems for
              communication, planning, and tournament preparation.
            </p>
          </section>

          <section>
            <Card className="border-teamy-primary/20 bg-teamy-primary/5">
              <CardContent className="p-8 md:p-10">
                <h2 className="text-2xl font-bold text-foreground mb-4">Our mission</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We want coaches and student leaders to spend more time mentoring and less time managing fragmented tools.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Teamy centralizes the day-to-day workflows that keep a team running so operations stay reliable during the full season.
                </p>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-5">How we build</h2>
            <div className="grid md:grid-cols-3 gap-5">
              {principles.map((item) => (
                <Card key={item.title} className="h-full">
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

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-5">Product journey</h2>
            <div className="space-y-3">
              {timeline.map((item) => (
                <details key={item.label} className="group rounded-xl border border-border bg-card p-4 open:border-teamy-primary/30">
                  <summary className="cursor-pointer list-none font-semibold text-foreground flex items-center justify-between">
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground group-open:hidden">Expand</span>
                    <span className="text-xs text-muted-foreground hidden group-open:inline">Collapse</span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="text-center">
            <Card>
              <CardContent className="p-8 md:p-10">
                <h2 className="text-2xl font-bold text-foreground mb-3">Want to try Teamy with your team?</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                  Create an account, explore workflows, and contact us with feedback as you evaluate fit.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/signup">
                    <Button size="lg">Create Free Account</Button>
                  </Link>
                  <Link href="/features">
                    <Button size="lg" variant="outline">Explore Features</Button>
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
