import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { PublicPageLayout } from '@/components/public-page-layout'

export const revalidate = 300

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) {
    return []
  }

  try {
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true },
    })

    return posts.map((post) => ({
      slug: post.slug,
    }))
  } catch (error) {
    // Keep builds green when DB access is unavailable during static generation.
    console.error('Failed to generate static blog params:', error)
    return []
  }
}

export default async function BlogPostPage({ params }: Props) {
  let resolvedParams: { slug: string }
  try {
    resolvedParams = await params
  } catch {
    notFound()
  }

  let post
  try {
    post = await prisma.blogPost.findUnique({
      where: { slug: resolvedParams.slug },
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        content: true,
        authorName: true,
        createdAt: true,
        published: true,
      },
    })
  } catch (error) {
    console.error(`Failed to load blog post for slug "${resolvedParams.slug}":`, error)
    post = null
  }

  if (!post || !post.published) {
    notFound()
  }

  let formattedDate: string
  try {
    formattedDate = format(new Date(post.createdAt), 'MMMM d, yyyy')
  } catch {
    formattedDate = ''
  }

  return (
    <PublicPageLayout>
      <div className="py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>

          <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-card">
            {post.coverImage && (
              <div className="mb-8 -mx-6 -mt-6 sm:-mx-10 sm:-mt-10 rounded-t-2xl overflow-hidden">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-56 sm:h-72 object-cover"
                />
              </div>
            )}

            <div className="mb-8">
              <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {post.authorName}
                </span>
                {formattedDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formattedDate}
                  </span>
                )}
              </div>
            </div>

            <hr className="border-border mb-8" />

            <article className="prose prose-slate dark:prose-invert prose-lg max-w-none prose-headings:font-heading prose-a:text-teamy-primary">
              <MarkdownRenderer content={post.content} />
            </article>
          </div>
        </div>
      </div>
    </PublicPageLayout>
  )
}
