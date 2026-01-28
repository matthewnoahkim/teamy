import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/blog/[slug] - Get a single blog post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: resolvedParams.slug },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Error fetching blog post:', error)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

// PATCH /api/blog/[slug] - Update a blog post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params
  try {
    const body = await request.json()
    const { title, slug: newSlug, excerpt, content, coverImage, published, authorName } = body

    const existingPost = await prisma.blogPost.findUnique({
      where: { slug: resolvedParams.slug },
    })

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // If slug is being changed, check for conflicts
    if (newSlug && newSlug !== resolvedParams.slug) {
      const slugConflict = await prisma.blogPost.findUnique({
        where: { slug: newSlug },
      })
      if (slugConflict) {
        return NextResponse.json(
          { error: 'A post with this slug already exists' },
          { status: 400 }
        )
      }
    }

    const post = await prisma.blogPost.update({
      where: { slug: resolvedParams.slug },
      data: {
        ...(title !== undefined && { title }),
        ...(newSlug !== undefined && { slug: newSlug }),
        ...(excerpt !== undefined && { excerpt }),
        ...(content !== undefined && { content }),
        ...(coverImage !== undefined && { coverImage }),
        ...(published !== undefined && { published }),
        ...(authorName !== undefined && { authorName }),
      },
    })

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Error updating blog post:', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

// DELETE /api/blog/[slug] - Delete a blog post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const resolvedParams = await params
  try {
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug: resolvedParams.slug },
    })

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    await prisma.blogPost.delete({
      where: { slug: resolvedParams.slug },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting blog post:', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}

