import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow access to:
  // - Home page (/)
  // - Static files and Next.js internals
  // - Public assets (images, fonts, etc.)
  if (
    pathname === '/' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/static/') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot|json)$/i)
  ) {
    return NextResponse.next()
  }

  // Redirect all other routes to home page (maintenance mode)
  return NextResponse.redirect(new URL('/', request.url))
}

// No matcher config needed - Next.js automatically matches all routes
// All exclusions are handled in the middleware function above

