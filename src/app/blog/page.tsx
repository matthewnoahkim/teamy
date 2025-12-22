import { prisma } from '@/lib/prisma'
import { PublicPageLayout } from '@/components/public-page-layout'
import { Calendar, User, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Blog
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Updates, announcements, and insights from the Teamy team
            </p>
          </div>

          {/* Blog Posts */}
          {posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No blog posts yet. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group block"
                >
                  <article className="p-8 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:border-teamy-primary/20 transition-all duration-300">
                    {post.coverImage && (
                      <div className="mb-6 rounded-xl overflow-hidden">
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <h2 className="font-heading text-2xl font-bold mb-3 text-foreground group-hover:text-teamy-primary transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          {post.authorName}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(post.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-sm text-teamy-primary font-semibold">
                        Read more
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicPageLayout>
  )
}
