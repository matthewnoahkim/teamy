import { NextResponse } from 'next/server'

export function middleware(request) {
  const pathname = request.nextUrl.pathname

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Allow home page
  if (pathname === '/') {
    return NextResponse.next()
  }

  // Redirect everything else to home (maintenance mode)
  return NextResponse.redirect(new URL('/', request.url))
}

