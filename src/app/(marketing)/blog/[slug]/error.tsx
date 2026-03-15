'use client'

import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'

export default function BlogPostError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="text-muted-foreground">
          We couldn&apos;t load this blog post. Please try again.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Link>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-teamy-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teamy-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
