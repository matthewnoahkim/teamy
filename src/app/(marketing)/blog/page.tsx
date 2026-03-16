import { prisma } from '@/lib/prisma'
import { PublicPageLayout } from '@/components/public-page-layout'
import { BlogPostList } from '@/components/blog-post-list'

export const revalidate = 300

export default async function BlogPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <PublicPageLayout>
        <div className="py-10 sm:py-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3">
                Blog
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Updates, announcements, and insights from the Teamy team
              </p>
            </div>
            <div className="text-center py-16 rounded-2xl border border-border bg-card">
              <p className="text-muted-foreground">No blog posts yet. Check back soon!</p>
            </div>
          </div>
        </div>
      </PublicPageLayout>
    )
  }

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
  }).catch((error) => {
    // Keep marketing builds resilient when DB access is unavailable.
    console.error('Failed to load published blog posts:', error)
    return []
  })

  return (
    <PublicPageLayout>
      <div className="py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3">
              Blog
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Updates, announcements, and insights from the Teamy team
            </p>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border bg-card">
              <p className="text-muted-foreground">No blog posts yet. Check back soon!</p>
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
