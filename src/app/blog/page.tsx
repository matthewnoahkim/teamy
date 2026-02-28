import { prisma } from '@/lib/prisma'
import { PublicPageLayout } from '@/components/public-page-layout'
import { BlogPostList } from '@/components/blog-post-list'

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      authorName: true,
      createdAt: true,
    },
  })

  return (
    <PublicPageLayout>
      <div className="py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Blog
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Updates, announcements, and insights from the Teamy team
            </p>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">No blog posts yet. Check back soon!</p>
            </div>
          ) : (
            <BlogPostList
              posts={posts.map((post) => ({
                ...post,
                createdAt: post.createdAt.toISOString(),
              }))}
            />
          )}
        </div>
      </div>
    </PublicPageLayout>
  )
}
