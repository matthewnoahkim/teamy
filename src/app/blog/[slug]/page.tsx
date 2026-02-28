import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { PublicPageLayout } from '@/components/public-page-layout'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function BlogPostPage({ params }: Props) {
  const resolvedParams = await params

  const post = await prisma.blogPost.findUnique({
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

  if (!post || !post.published) {
    notFound()
  }

  return (
    <PublicPageLayout>
      <main className="py-12 px-4 sm:px-6 overflow-x-hidden">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to blog</span>
          </Link>

          {post.coverImage && (
            <div className="mb-8 rounded-2xl overflow-hidden shadow-card border border-border">
              <Image
                src={post.coverImage}
                alt={post.title}
                width={1200}
                height={640}
                sizes="(max-width: 768px) 100vw, 768px"
                className="w-full h-64 md:h-80 object-cover"
                priority
              />
            </div>
          )}

          <header className="mb-10">
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-5">
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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

          <article className="prose prose-slate dark:prose-invert prose-lg max-w-none prose-headings:font-heading prose-a:text-teamy-primary">
            <MarkdownRenderer content={post.content} />
          </article>
        </div>
      </main>
    </PublicPageLayout>
  )
}
