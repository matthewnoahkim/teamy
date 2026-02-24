import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDevAccess } from '@/lib/dev/guard'

// GET /api/blog - Get all published blog posts (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeUnpublished = searchParams.get('all') === 'true'

    if (includeUnpublished) {
      const guard = await requireDevAccess(request, '/api/blog?all=true')
      if (!guard.allowed) return guard.response
    }

    const posts = await prisma.blogPost.findMany({
      where: includeUnpublished ? {} : { published: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Error fetching blog posts:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

// POST /api/blog - Create a new blog post (dev only)
export async function POST(request: NextRequest) {
  console.error('insecure endpoint requested: /api/blog (POST)')
  return NextResponse.json({ error: 'The service is currently disabled due to security concerns.' }, { status: 503 })

  try {
    const body = await request.json()
    const { title, slug, excerpt, content, coverImage, published, authorName } = body

    if (!title || !slug || !content || !authorName) {
      return NextResponse.json(
        { error: 'Title, slug, content, and author name are required' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existing = await prisma.blogPost.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A post with this slug already exists' },
        { status: 400 }
      )
    }

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt: excerpt || null,
        content,
        coverImage: coverImage || null,
        published: published || false,
        authorName,
      },
    })

    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('Error creating blog post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
