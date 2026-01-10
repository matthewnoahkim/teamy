import { PublicPageLayout } from '@/components/public-page-layout'
import { 
  MessageSquare, 
  Calendar, 
  ClipboardCheck, 
  FileText, 
  BarChart3, 
  FolderKanban, 
  DollarSign, 
  Wrench 
} from 'lucide-react'
import { StickyScroll } from '@/components/ui/sticky-scroll-reveal'
import { DemoRequestDialog } from '@/components/demo-request-dialog'

const stickyScrollContent = [
  {
    title: 'Communication Hub',
    description: 'Keep your team connected with announcements, threaded replies, reactions, and email notifications. Share updates with specific roles or the entire team. Real-time notifications ensure everyone stays informed.',
    content: (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="bg-card rounded-xl p-6 shadow-lg w-full max-w-full border border-teamy-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-8 w-8 text-teamy-primary flex-shrink-0" />
            <h3 className="font-bold text-lg text-foreground leading-tight">Team Announcements</h3>
          </div>
          <p className="text-sm text-muted-foreground">Stay connected and informed with real-time updates</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Smart Planning',
    description: 'Schedule practices, meetings, and competitions with ease. RSVP tracking, recurring events, and calendar integration keep everyone organized. Automatic reminders and conflict detection prevent scheduling issues.',
    content: (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="bg-card rounded-xl p-6 shadow-lg w-full border border-teamy-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-8 w-8 text-teamy-primary" />
            <h3 className="font-bold text-lg text-foreground">Event Calendar</h3>
          </div>
          <p className="text-sm text-muted-foreground">Keep everyone on the same schedule</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Event Rosters',
    description: 'Assign students to Science Olympiad events with AI assistance. Automatic conflict detection and capacity limits ensure optimal team composition. Track member preferences and availability to build the perfect roster.',
    content: (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="bg-card rounded-xl p-6 shadow-lg w-full border border-teamy-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <ClipboardCheck className="h-8 w-8 text-teamy-primary" />
            <h3 className="font-bold text-lg text-foreground">AI-Powered Rosters</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">Anatomy & Physiology</span>
              <span className="text-teamy-primary font-semibold">✓ 2/2</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground">Disease Detectives</span>
              <span className="text-teamy-primary font-semibold">✓ 2/2</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground">Forensics</span>
              <span className="text-teamy-accent font-semibold">⚠ 1/2</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Testing Platform',
    description: 'Create and grade tests with multiple question types. AI-powered grading, proctoring tools, built-in calculator, and customizable score release. Support for multiple choice, short answer, and essay questions with automatic grading.',
    content: (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="bg-card rounded-xl p-6 shadow-lg w-full border border-teamy-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8 text-teamy-primary" />
            <h3 className="font-bold text-lg text-foreground">Test Creator</h3>
          </div>
          <p className="text-sm text-muted-foreground">AI-powered grading and proctoring</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Performance Analytics',
    description: 'Track team performance with detailed statistics and insights. Monitor attendance, test scores, and event participation at a glance. Generate reports and identify areas for improvement with data-driven insights.',
    content: (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="bg-card rounded-xl p-6 shadow-lg w-full border border-teamy-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="h-8 w-8 text-teamy-primary" />
            <h3 className="font-bold text-lg text-foreground">Team Statistics</h3>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">Attendance Rate</span>
                <span className="font-semibold text-foreground">94%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-teamy-primary h-2 rounded-full" style={{width: '94%'}}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-foreground">Test Completion</span>
                <span className="font-semibold text-foreground">88%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-teamy-accent h-2 rounded-full" style={{width: '88%'}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Team Organization',
    description: 'Manage clubs, teams, and members with powerful admin tools. Photo albums, file sharing, and customizable dashboard widgets. Everything you need to keep your team organized and running smoothly.',
    content: (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="bg-card rounded-xl p-6 shadow-lg w-full border border-teamy-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <FolderKanban className="h-8 w-8 text-teamy-primary" />
            <h3 className="font-bold text-lg text-foreground">Organization Tools</h3>
          </div>
          <p className="text-sm text-muted-foreground">Manage everything in one place</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Financial Management',
    description: 'Track event budgets and expenses effortlessly. Purchase request approval system with automatic budget enforcement and reporting. Never go over budget with real-time tracking and alerts.',
    content: (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="bg-card rounded-xl p-6 shadow-lg w-full border border-teamy-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="h-8 w-8 text-teamy-primary" />
            <h3 className="font-bold text-lg text-foreground">Budget Overview</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground">Total Budget</span>
              <span className="font-semibold text-foreground">$5,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground">Spent</span>
              <span className="text-teamy-accent">$3,200</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground">Remaining</span>
              <span className="text-teamy-primary">$1,800</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Essential Tools',
    description: 'Forms, to-do lists, attendance tracking, and more. Everything you need to run your Science Olympiad team efficiently in one place. Streamline your workflow with integrated tools designed for team management.',
    content: (
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="bg-card rounded-xl p-6 shadow-lg w-full border border-teamy-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <Wrench className="h-8 w-8 text-teamy-primary" />
            <h3 className="font-bold text-lg text-foreground">Productivity Suite</h3>
          </div>
          <p className="text-sm text-muted-foreground">Forms, to-dos, and more</p>
        </div>
      </div>
    ),
  },
]

export default function FeaturesPage() {
  return (
    <PublicPageLayout>
      <div className="container mx-auto px-4 sm:px-6 py-12 md:py-16 lg:py-20 max-w-7xl">
        {/* Page Title */}
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 md:mb-6">
            Features
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Everything you need to manage your Science Olympiad team
          </p>
        </div>

        {/* Sticky Scroll Section - Full Width */}
        <StickyScroll content={stickyScrollContent} />

        {/* Schedule Demo CTA */}
        <div className="text-center mt-16 md:mt-20 lg:mt-24 mb-8">
          <DemoRequestDialog />
        </div>
      </div>
    </PublicPageLayout>
  )
}
