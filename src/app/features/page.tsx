import { PublicPageLayout } from '@/components/public-page-layout'
import { ScrollDrivenFeatures } from '@/components/scroll-driven-features'
import { ScrollAnimate } from '@/components/scroll-animate'

const heroFeatures = [
  {
    icon: 'MessageSquare' as const,
    title: 'Communication',
    description: 'Keep your team connected with announcements, threaded replies, reactions, and email notifications. Share updates with specific roles or the entire team.',
  },
  {
    icon: 'Calendar' as const,
    title: 'Planning',
    description: 'Schedule practices, meetings, and competitions with ease. RSVP tracking, recurring events, and calendar integration keep everyone organized.',
  },
  {
    icon: 'ClipboardCheck' as const,
    title: 'Rosters',
    description: 'Assign students to Science Olympiad events with AI assistance. Automatic conflict detection and capacity limits ensure optimal team composition.',
  },
  {
    icon: 'FileText' as const,
    title: 'Tests',
    description: 'Create and grade tests with multiple question types. AI-powered grading, proctoring tools, built-in calculator, and customizable score release.',
  },
  {
    icon: 'BarChart3' as const,
    title: 'Analytics',
    description: 'Track team performance with detailed statistics and insights. Monitor attendance, test scores, and event participation at a glance.',
  },
  {
    icon: 'FolderKanban' as const,
    title: 'Organization',
    description: 'Manage clubs, teams, and members with powerful admin tools. Photo albums, file sharing, and customizable dashboard widgets.',
  },
  {
    icon: 'DollarSign' as const,
    title: 'Finance',
    description: 'Track event budgets and expenses effortlessly. Purchase request approval system with automatic budget enforcement and reporting.',
  },
  {
    icon: 'Wrench' as const,
    title: 'Tools',
    description: 'Forms, to-do lists, attendance tracking, and more. Everything you need to run your Science Olympiad team efficiently in one place.',
  },
]

export default function FeaturesPage() {
  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        {/* Scroll-driven feature showcase with header and footer */}
        <ScrollDrivenFeatures features={heroFeatures} />
        
        {/* CTA at the bottom */}
        <div className="max-w-6xl mx-auto mt-20">
          <ScrollAnimate animation="bounce-in" delay={200}>
            <div className="text-center">
              <a href="/login">
                <button className="group relative px-8 py-4 text-lg font-semibold bg-teamy-primary text-white rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-teamy-primary-dark to-teamy-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative z-10 flex items-center gap-2">
                    Get started
                    <svg className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              </a>
            </div>
          </ScrollAnimate>
        </div>
      </div>
    </PublicPageLayout>
  )
}
