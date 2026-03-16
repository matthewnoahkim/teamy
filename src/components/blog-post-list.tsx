'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Calendar, Search, User } from 'lucide-react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'

interface BlogPostPreview {
  id: string
  slug: string
  title: string
  excerpt: string | null
  coverImage: string | null
  authorName: string
  createdAt: string
}

interface BlogPostListProps {
  posts: BlogPostPreview[]
}

type SortMode = 'newest' | 'oldest'

export function BlogPostList({ posts }: BlogPostListProps) {
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const searched = normalizedQuery
      ? posts.filter((post) => {
          const haystack = `${post.title} ${post.excerpt ?? ''} ${post.authorName}`.toLowerCase()
          return haystack.includes(normalizedQuery)
        })
      : posts

    return [...searched].sort((a, b) => {
      const aDate = new Date(a.createdAt).getTime()
      const bDate = new Date(b.createdAt).getTime()
      return sortMode === 'newest' ? bDate - aDate : aDate - bDate
    })
  }, [posts, query, sortMode])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts..."
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}</span>
            <div className="inline-flex rounded-full border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setSortMode('newest')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  sortMode === 'newest' ? 'bg-teamy-primary text-white' : 'text-foreground hover:bg-muted'
                }`}
              >
                Newest
              </button>
              <button
                type="button"
                onClick={() => setSortMode('oldest')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  sortMode === 'oldest' ? 'bg-teamy-primary text-white' : 'text-foreground hover:bg-muted'
                }`}
              >
                Oldest
              </button>
            </div>
          </div>
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-border bg-card">
          <p className="text-muted-foreground">No posts matched your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block"
            >
              <article className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-card hover:border-teamy-primary/30 transition-colors duration-200">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground group-hover:text-teamy-primary transition-colors mb-1.5">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {post.authorName}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(post.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <span className="hidden sm:flex items-center gap-1 text-sm text-teamy-primary font-semibold shrink-0 mt-1">
                    Read
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
