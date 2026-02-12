import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

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

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Note: Exclusions are handled in the middleware function itself
     * Using a simple pattern without capturing groups for Vercel compatibility
     */
    '/:path*',
  ],
}

