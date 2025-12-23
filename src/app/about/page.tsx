import { PublicPageLayout } from '@/components/public-page-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { 
  Github, 
  Heart, 
  Target, 
  Users, 
  Lightbulb,
  Trophy,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'

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
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-teamy-primary/10 rounded-lg">
                  <Target className="h-6 w-6 text-teamy-primary" />
                </div>
                <h2 className="text-2xl font-bold">Our Mission</h2>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Science Olympiad is an incredible program that inspires students to pursue STEM through 
                hands-on competition. But behind every successful team is a mountain of administrative 
                work—managing rosters, tracking attendance, creating practice tests, organizing events, 
                and so much more.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                <strong className="text-foreground">We believe that coaches, captains, and tournament directors 
                should spend their time mentoring students and building their teams—not wrestling with 
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
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">Leveling the Playing Field</h2>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Some Science Olympiad teams have dedicated coaches, abundant resources, and established 
                systems built over years of competition. Others are just getting started, led by 
                passionate students trying to figure it all out on their own.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Teamy levels the playing field. Whether you&apos;re a well-funded team with a decade of 
                state championships or a brand-new club meeting after school in a classroom, you 
                deserve access to:
              </p>
              <ul className="space-y-3 text-lg text-muted-foreground mb-6">
                <li className="flex items-start gap-3">
                  <Trophy className="h-5 w-5 text-teamy-primary mt-1 flex-shrink-0" />
                  <span>Instant AI-powered test uploads and grading</span>
                </li>
                <li className="flex items-start gap-3">
                  <Trophy className="h-5 w-5 text-teamy-primary mt-1 flex-shrink-0" />
                  <span>Smart roster management that prevents scheduling conflicts</span>
                </li>
                <li className="flex items-start gap-3">
                  <Trophy className="h-5 w-5 text-teamy-primary mt-1 flex-shrink-0" />
                  <span>Streamlined communication with your entire team</span>
                </li>
                <li className="flex items-start gap-3">
                  <Trophy className="h-5 w-5 text-teamy-primary mt-1 flex-shrink-0" />
                  <span>A comprehensive, easy-to-use tournament hosting platform</span>
                </li>
              </ul>
              <p className="text-lg font-medium text-foreground">
                Great Science Olympiad programs shouldn&apos;t be limited to schools with the most resources. 
                With Teamy, every team has the tools to succeed.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Our Story */}
        <section className="mb-16">
          <Card className="overflow-hidden">
            <CardContent className="p-8 md:p-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Lightbulb className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold">Our Story</h2>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Teamy was created by a first-time Science Olympiad captain and tournament director 
                who experienced firsthand just how overwhelming it can be to manage a team while 
                also being a student.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Between juggling event assignments, coordinating practice schedules, creating study 
                materials, tracking attendance, managing budgets, and organizing an invitational 
                tournament—all while keeping up with schoolwork—it became clear that Science Olympiad 
                leaders needed better tools.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                After searching for solutions and finding only scattered spreadsheets, outdated 
                websites, and expensive enterprise software, the decision was made: if the perfect 
                tool didn&apos;t exist, we&apos;d build it ourselves.
              </p>
              <p className="text-lg font-medium text-foreground">
                Teamy is the platform we wish we had when we first took on leadership. Now, we&apos;re 
                sharing it with the entire Science Olympiad community.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Open Source */}
        <section className="mb-16">
          <Card className="overflow-hidden bg-slate-900 dark:bg-slate-800 text-white">
            <CardContent className="p-8 md:p-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/10 rounded-lg">
                  <Github className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">Open Source</h2>
              </div>
              <p className="text-lg text-slate-300 leading-relaxed mb-6">
                Teamy is open source because we believe in transparency and community. You can view 
                our code, suggest improvements, report bugs, or even contribute new features.
              </p>
              <p className="text-lg text-slate-300 leading-relaxed mb-8">
                We&apos;re building this in the open because Science Olympiad is a community—and 
                Teamy should be one too.
              </p>
              <Link 
                href="https://github.com/matthewnoahkim/teamy" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="lg" className="gap-2">
                  <Github className="h-5 w-5" />
                  View on GitHub
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <Card className="overflow-hidden border-teamy-primary/20 bg-teamy-primary/5">
            <CardContent className="p-8 md:p-12">
              <Heart className="h-12 w-12 text-teamy-primary mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-4">
                Ready to Transform Your Team?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Join hundreds of Science Olympiad teams already using Teamy to streamline 
                their operations and elevate their programs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login">
                  <Button size="lg" className="gap-2">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/features">
                  <Button variant="outline" size="lg">
                    Explore Features
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
