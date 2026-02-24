import { PublicPageLayout } from '@/components/public-page-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Heart } from 'lucide-react'

export const metadata = {
  title: 'About | Teamy',
  description: 'Learn about why we built Teamy - the all-in-one platform for Science Olympiad team management.',
}

export default function AboutPage() {
  return (
    <PublicPageLayout>
      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            About
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built by Science Olympiad competitors, for Science Olympiad teams.
          </p>
        </div>

        {/* Mission Section */}
        <section className="mb-16">
          <Card className="overflow-hidden">
            <CardContent className="p-8 md:p-12">
              <h2 className="text-2xl font-bold mb-6">Our Mission</h2>
              <p className="text-base text-muted-foreground leading-normal mb-4">
                Science Olympiad is an incredible program that inspires students to pursue STEM through 
                hands-on competition. But behind every successful team is a mountain of administrative 
                work—managing rosters, tracking attendance, creating practice tests, organizing events, 
                and so much more.
              </p>
              <p className="text-base text-muted-foreground leading-normal">
                <strong className="text-foreground">We believe that coaches, captains, and tournament directors 
                should spend their time mentoring students and building their teams, not wrestling with 
                spreadsheets and scattered tools.</strong> That&apos;s why we built Teamy: to give every 
                Science Olympiad team access to the same powerful management tools, regardless of their 
                school&apos;s resources.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Leveling the Playing Field */}
        <section className="mb-16">
          <Card className="overflow-hidden">
            <CardContent className="p-8 md:p-12">
              <h2 className="text-2xl font-bold mb-6">Leveling the Playing Field</h2>
              <p className="text-base text-muted-foreground leading-normal mb-4">
                Some Science Olympiad teams have multiple dedicated coaches, abundant resources, and established 
                systems built over years of competition. Others are just getting started, led by 
                passionate students trying to figure it all out on their own.
              </p>
              <p className="text-base text-muted-foreground leading-normal mb-4">
                Teamy levels the playing field. Whether you&apos;re a well-funded team with a decade of 
                state championships or a brand-new club meeting during lunch in a small classroom, you 
                deserve access to the same powerful management tools.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Our Story */}
        <section className="mb-16">
          <Card className="overflow-hidden">
            <CardContent className="p-8 md:p-12">
              <h2 className="text-2xl font-bold mb-6">Our Story</h2>
              <p className="text-base text-muted-foreground leading-normal mb-4">
                Teamy was created by a first-time Science Olympiad captains and tournament directors
                who experienced firsthand just how overwhelming it can be to manage a team while 
                also being a student.
              </p>
              <p className="text-base text-muted-foreground leading-normal mb-4">
                Between juggling rosters, coordinating practice schedules, creating study materials,
                tracking attendance, managing budgets, and organizing logistics for invitational 
                tournaments, it became clear that Science Olympiad leaders needed better tools.
              </p>
              <p className="text-base text-muted-foreground leading-normal mb-4">
                After searching for solutions and finding only scattered spreadsheets, outdated 
                websites, and expensive enterprise software, the decision was made: if the perfect 
                tool didn&apos;t exist, we&apos;d build it ourselves.
              </p>
              <p className="text-base font-medium text-foreground">
                Teamy is the platform we wish we had when we first took on Science Olympiad leadership.
                Now, we&apos;re sharing it with the entire community.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <Card className="overflow-hidden border-teamy-primary/20 bg-teamy-primary/5">
            <CardContent className="p-8 md:p-12">
              <h2 className="text-2xl font-bold mb-4">
                Ready to Transform Your Team?
              </h2>
              <p className="text-base text-muted-foreground mb-8 max-w-xl mx-auto">
                Join hundreds of Science Olympiad teams already using Teamy to streamline 
                their operations and elevate their programs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/features">
                  <Button variant="outline" size="lg">
                    Explore Features
                  </Button>
                </Link>
                <Link href="https://donate.stripe.com/test_your_link_here" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="gap-2 border-teamy-primary text-teamy-primary hover:bg-teamy-primary hover:text-white">
                    <Heart className="h-4 w-4" />
                    Donate
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PublicPageLayout>
  )
}
