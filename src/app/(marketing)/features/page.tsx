import type React from 'react'
import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { DemoRequestDialog } from '@/components/demo-request-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  DollarSign,
  FileText,
  FolderKanban,
  MessageSquare,
  Users,
  Wrench,
} from 'lucide-react'

type FeatureItem = {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const coreFeatures: FeatureItem[] = [
  {
    title: 'Communication Hub',
    description: 'Share announcements, updates, and reminders with the right members using clear role-based visibility.',
    icon: MessageSquare,
  },
  {
    title: 'Smart Planning',
    description: 'Coordinate practices, meetings, and deadlines with one shared calendar and cleaner scheduling.',
    icon: Calendar,
  },
  {
    title: 'Event Rosters',
    description: 'Build and maintain event assignments with better visibility into coverage and conflicts.',
    icon: ClipboardCheck,
  },
  {
    title: 'Testing Platform',
    description: 'Create, distribute, and review tests in one workflow with support for practice and competition prep.',
    icon: FileText,
  },
  {
    title: 'Performance Analytics',
    description: 'Track progress, attendance, and engagement so coaches can make data-informed decisions.',
    icon: BarChart3,
  },
  {
    title: 'Team Organization',
    description: 'Manage members, roles, teams, files, and internal resources from a unified workspace.',
    icon: FolderKanban,
  },
  {
    title: 'Financial Management',
    description: 'Monitor budgets, expenses, and requests so spending stays transparent and under control.',
    icon: DollarSign,
  },
  {
    title: 'Essential Tools',
    description: 'Use forms, to-dos, attendance, and day-to-day operations tools without switching between apps.',
    icon: Wrench,
  },
]

const roleHighlights = [
  {
    title: 'For Coaches',
    description: 'Keep your team organized with less admin overhead and more clarity across events and members.',
  },
  {
    title: 'For Captains',
    description: 'Coordinate peers, communicate faster, and stay ahead of deadlines with shared visibility.',
  },
  {
    title: 'For Tournament Staff',
    description: 'Run registrations, communication, and operational workflows from one consistent system.',
  },
]

export default function FeaturesPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <section className="text-center mb-12">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Features
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Everything your Science Olympiad team needs to communicate, plan, practice, and compete with less friction.
            </p>
          </section>

          <section className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Core Capabilities</h2>
              <p className="mt-2 text-muted-foreground text-base md:text-lg max-w-3xl">
                Teamy brings team operations into a single system so communication, planning, and execution stay aligned.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {coreFeatures.map((feature) => (
                <Card key={feature.title} className="h-full">
                  <CardHeader className="pb-3">
                    <div className="h-10 w-10 rounded-xl bg-teamy-primary/10 border border-teamy-primary/20 flex items-center justify-center mb-3">
                      <feature.icon className="h-5 w-5 text-teamy-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Built for Every Role</h2>
              <p className="mt-2 text-muted-foreground text-base md:text-lg max-w-3xl">
                Different responsibilities, one shared workspace.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {roleHighlights.map((item) => (
                <Card key={item.title}>
                  <CardHeader className="pb-2">
                    <div className="h-9 w-9 rounded-lg bg-teamy-primary/10 border border-teamy-primary/20 flex items-center justify-center mb-2">
                      <Users className="h-4 w-4 text-teamy-primary" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-teamy-primary/20 bg-teamy-primary/5 p-8 md:p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">See Teamy in your workflow</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Get a walkthrough tailored to your team&apos;s current process and goals.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <DemoRequestDialog buttonText="Schedule a Demo" />
              <Link href="/signup">
                <Button size="lg" variant="outline">
                  Create Free Account
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  )
}
