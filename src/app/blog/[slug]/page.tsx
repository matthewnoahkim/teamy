import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { HomeNav } from '@/components/home-nav'
import { format } from 'date-fns'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { cookies } from 'next/headers'

interface Props {
  params: Promise<{ slug: string }>
}

async function getLoggedInUserRedirect(userId: string) {
  // Check if user has any club memberships
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { club: true },
    orderBy: { createdAt: 'desc' }
  })

  if (memberships.length === 0) {
    return '/no-clubs'
  }

  // Check for last visited club cookie
  const cookieStore = await cookies()
  const lastVisitedClub = cookieStore.get('lastVisitedClub')?.value

  if (lastVisitedClub) {
    // Verify the user is still a member of this club
    const isMember = memberships.some(m => m.club.id === lastVisitedClub)
    if (isMember) {
      return `/club/${lastVisitedClub}`
    }
  }

  // Default to first club
  return `/club/${memberships[0].club.id}`
}

export default async function BlogPostPage({ params }: Props) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user
  
  // Get smart redirect for logged-in users
  const loggedInRedirect = isLoggedIn && session?.user?.id 
    ? await getLoggedInUserRedirect(session.user.id)
    : '/login'

  const post = await prisma.blogPost.findUnique({
    where: { slug: resolvedParams.slug },
  })

  if (!post || !post.published) {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground grid-pattern">
      {/* Header */}
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-2 overflow-x-auto">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6 flex-shrink-0">
            <HomeNav 
              variant="light" 
              mobileButton={
                <Link href={isLoggedIn ? loggedInRedirect : "/login"}>
                  <button className="w-full px-4 py-2.5 text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors shadow-sm">
                    Sign In
                  </button>
                </Link>
              }
            />
            <Link href={isLoggedIn ? loggedInRedirect : "/login"} className="hidden md:block">
              <button className="px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors shadow-sm whitespace-nowrap">
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-16 px-4 sm:px-6 overflow-x-hidden">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link href="/blog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to blog</span>
          </Link>

          {/* Cover Image */}
          {post.coverImage && (
            <div className="mb-8 rounded-2xl overflow-hidden shadow-card">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-64 md:h-80 object-cover"
              />
            </div>
          )}

          {/* Header */}
          <header className="mb-12">
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-6 bg-transparent">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground bg-transparent">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {post.authorName}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(new Date(post.createdAt), 'MMMM d, yyyy')}
              </span>
            </div>
          </header>

          {/* Content */}
          <article className="prose prose-slate dark:prose-invert prose-lg max-w-none prose-headings:font-heading prose-a:text-teamy-primary">
            <MarkdownRenderer content={post.content} />
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
              <p className="text-xs text-muted-foreground font-medium">FERPA and COPPA compliant</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
