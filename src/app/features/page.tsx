import { PublicPageLayout } from '@/components/public-page-layout'
import { ScrollAnimate } from '@/components/scroll-animate'
import { 
  Users, Calendar, ClipboardCheck, DollarSign, FileText, Trophy,
  Image, FileCheck, CheckSquare, LayoutDashboard, Bot, Sparkles,
  ArrowLeft, Shield, Bell, Zap
} from 'lucide-react'
import Link from 'next/link'

const features = [
  {
    category: 'Core',
    items: [
      {
        icon: Users,
        title: 'Clubs & Teams',
        description: 'Division B/C clubs with multiple teams, admin/member roles, invite codes & links',
        color: 'from-blue-500 to-cyan-500'
      },
      {
        icon: ClipboardCheck,
        title: 'Event Rosters',
        description: '2026 SO events, conflict detection/capacity limits, AI-assisted event assignments',
        color: 'from-purple-500 to-pink-500'
      },
      {
        icon: Bell,
        title: 'Announcements',
        description: 'Scoped visibility, file attachments, reactions, threaded replies, email notifications',
        color: 'from-amber-500 to-orange-500'
      },
      {
        icon: Calendar,
        title: 'Calendar',
        description: 'Personal, team, and club events with RSVP, recurring events, and role targeting',
        color: 'from-green-500 to-emerald-500'
      },
      {
        icon: Shield,
        title: 'Attendance',
        description: 'Check-in codes, grace periods, and CSV export',
        color: 'from-red-500 to-rose-500'
      }
    ]
  },
  {
    category: 'Finance',
    items: [
      {
        icon: DollarSign,
        title: 'Event Budgets',
        description: 'Per-event budgets with automatic expense tracking',
        color: 'from-emerald-500 to-teal-500'
      },
      {
        icon: FileCheck,
        title: 'Purchase Requests',
        description: 'Approval system with budget enforcement',
        color: 'from-cyan-500 to-blue-500'
      },
    ]
  },
  {
    category: 'Testing',
    items: [
      {
        icon: FileText,
        title: 'Question Types',
        description: 'MCQ (single/multi answer), short text, long text, numeric',
        color: 'from-violet-500 to-purple-500'
      },
      {
        icon: Shield,
        title: 'Proctoring',
        description: 'Tab switch tracking, fullscreen enforcement, copy/paste detection',
        color: 'from-red-500 to-orange-500'
      },
      {
        icon: Sparkles,
        title: 'Tools',
        description: 'Built-in calculator (4-func/scientific/graphing), note sheet upload, admin review',
        color: 'from-yellow-500 to-amber-500'
      },
      {
        icon: Bot,
        title: 'AI Grading',
        description: 'OpenAI-powered FRQ grading with suggestions',
        color: 'from-indigo-500 to-blue-500'
      },
      {
        icon: FileCheck,
        title: 'Score Release',
        description: 'Configurable modes (none, score only, wrong answers, full test)',
        color: 'from-pink-500 to-rose-500'
      }
    ]
  },
  {
    category: 'Tournaments',
    items: [
      {
        icon: Trophy,
        title: 'Invitationals',
        description: 'Create & manage tournaments',
        color: 'from-amber-500 to-yellow-500'
      },
      {
        icon: Users,
        title: 'Registration',
        description: 'Team registration with event selection',
        color: 'from-blue-500 to-indigo-500'
      },
      {
        icon: FileText,
        title: 'Tournament Tests',
        description: 'Tournament-specific tests',
        color: 'from-purple-500 to-violet-500'
      }
    ]
  },
  {
    category: 'Other',
    items: [
      {
        icon: Image,
        title: 'Gallery',
        description: 'Photo albums with image/video support',
        color: 'from-rose-500 to-pink-500'
      },
      {
        icon: FileCheck,
        title: 'Paperwork',
        description: 'Form distribution with submission tracking',
        color: 'from-cyan-500 to-sky-500'
      },
      {
        icon: CheckSquare,
        title: 'To-Do\'s',
        description: 'Personal task lists with priorities & due dates',
        color: 'from-green-500 to-lime-500'
      },
      {
        icon: LayoutDashboard,
        title: 'Dashboard Widgets',
        description: 'Customizable homepage with 12+ widget types',
        color: 'from-blue-500 to-purple-500'
      },
      {
        icon: Users,
        title: 'Member Preferences',
        description: 'Event preferences, custom backgrounds, admin notes',
        color: 'from-violet-500 to-fuchsia-500'
      },
      {
        icon: Zap,
        title: 'Stats',
        description: 'Team performance analytics',
        color: 'from-orange-500 to-red-500'
      }
    ]
  }
]

export default function FeaturesPage() {
  return (
    <PublicPageLayout>
      <div className="py-16 px-4 sm:px-6 relative">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-teamy-primary/10 to-transparent blur-3xl" />
          <div className="absolute bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-purple-500/10 to-transparent blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Back link */}
          <ScrollAnimate animation="fade-in">
            <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 hover:translate-x-[-4px] duration-300">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back to home</span>
            </Link>
          </ScrollAnimate>

          {/* Header */}
          <ScrollAnimate animation="elegant" delay={100}>
            <div className="text-center mb-16">
              <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-teamy-primary via-teamy-accent to-teamy-primary bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                  Features
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Everything you need to manage your Science Olympiad team
              </p>
            </div>
          </ScrollAnimate>

          {/* Features */}
          <div className="space-y-16">
            {features.map((category, categoryIndex) => (
              <div key={category.category}>
                <ScrollAnimate animation="fade-up" delay={categoryIndex * 50}>
                  <h2 className="font-heading text-2xl font-bold mb-8 text-foreground border-b border-border pb-4">
                    {category.category}
                  </h2>
                </ScrollAnimate>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.items.map((feature, index) => (
                    <ScrollAnimate 
                      key={feature.title} 
                      animation="fade-scale" 
                      delay={100 + index * 100}
                    >
                      <div className="group relative h-full">
                        {/* Animated border gradient */}
                        <div className={`absolute -inset-[1px] bg-gradient-to-br ${feature.color} rounded-2xl opacity-0 group-hover:opacity-100 blur-sm transition-all duration-500`} />
                        
                        {/* Card content */}
                        <div className="relative h-full p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border shadow-card hover:shadow-card-hover transition-all duration-500 hover:scale-[1.02]">
                          {/* Icon with gradient */}
                          <div className="relative w-12 h-12 rounded-xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                            <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-10 rounded-xl`} />
                            <div className="relative w-full h-full flex items-center justify-center">
                              <feature.icon className="h-6 w-6 text-teamy-primary" />
                            </div>
                          </div>
                          
                          <h3 className="font-heading text-lg font-semibold mb-2 text-foreground group-hover:text-teamy-primary transition-colors">
                            {feature.title}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {feature.description}
                          </p>

                          {/* Hover glow effect */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-500 pointer-events-none`} />
                        </div>
                      </div>
                    </ScrollAnimate>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <ScrollAnimate animation="bounce-in" delay={200}>
            <div className="mt-20 text-center">
              <Link href="/login">
                <button className="group relative px-8 py-4 text-lg font-semibold bg-teamy-primary text-white rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-teamy-primary-dark to-teamy-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative z-10 flex items-center gap-2">
                    Get started
                    <ArrowLeft className="h-5 w-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </Link>
            </div>
          </ScrollAnimate>
        </div>
      </div>
    </PublicPageLayout>
  )
}
