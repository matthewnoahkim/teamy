import { PublicPageLayout } from '@/components/public-page-layout'
import { ScrollDrivenFeatures } from '@/components/scroll-driven-features'

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
      </div>
    </PublicPageLayout>
  )
}
