import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from '@/components/ui/toaster'
import { FaviconLoader } from '@/components/favicon-loader'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Teamy',
  description: 'Team management platform',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

function generateBackgroundStyles(preferences: Record<string, unknown> | null): string {
  const bgType = preferences?.backgroundType as string | undefined
  const isGrid = !bgType || bgType === 'grid'
  
  let backgroundCss = ''
  
  if (isGrid) {
    // Default grid pattern - html gets default background, body is transparent with grid-pattern class
    backgroundCss = `
      html {
        background-color: hsl(var(--background)) !important;
      }
      body {
        background-color: transparent !important;
        background-size: 24px 24px !important;
        background-position: 0 0 !important;
        background-repeat: repeat !important;
        background-attachment: fixed !important;
      }
    `
  } else if (bgType === 'solid' && preferences?.backgroundColor) {
    const color = preferences.backgroundColor as string
    // Escape the color for CSS (basic sanitization)
    const safeColor = color.replace(/[<>'"]/g, '')
    backgroundCss = `
      html, body {
        background: ${safeColor} !important;
        background-image: none !important;
        background-attachment: fixed !important;
      }
      body.grid-pattern, html.grid-pattern, .grid-pattern,
      *[class*="grid-pattern"] {
        background: ${safeColor} !important;
        background-image: none !important;
      }
      .bg-slate-50, .bg-slate-900, .dark\\:bg-slate-900,
      [class*="bg-slate"], section.bg-slate-50, section.bg-slate-900,
      section[class*="bg-slate"], div.bg-slate-50, div.bg-slate-900,
      div[class*="bg-slate"], div.bg-background, section.bg-background {
        background-color: transparent !important;
        background: transparent !important;
      }
    `
  } else if (bgType === 'gradient' && Array.isArray(preferences?.gradientColors)) {
    const gradientColors = preferences.gradientColors as string[]
    if (gradientColors.length >= 2) {
      const gradientStops = gradientColors
        .map((color, index) => {
          const safeColor = color.replace(/[<>'"]/g, '')
          return `${safeColor} ${(index / (gradientColors.length - 1)) * 100}%`
        })
        .join(', ')
      const direction = ((preferences.gradientDirection as string) || '135deg').replace(/[<>'"]/g, '')
      const gradient = `linear-gradient(${direction}, ${gradientStops})`
      backgroundCss = `
        html, body {
          background: ${gradient} !important;
          background-image: ${gradient} !important;
          background-attachment: fixed !important;
        }
        body.grid-pattern, html.grid-pattern, .grid-pattern,
        *[class*="grid-pattern"] {
          background: ${gradient} !important;
          background-image: ${gradient} !important;
        }
        .bg-slate-50, .bg-slate-900, .dark\\:bg-slate-900,
        [class*="bg-slate"], section.bg-slate-50, section.bg-slate-900,
        section[class*="bg-slate"], div.bg-slate-50, div.bg-slate-900,
        div[class*="bg-slate"], div.bg-background, section.bg-background {
          background-color: transparent !important;
          background: transparent !important;
        }
      `
    } else {
      // Invalid gradient, fall back to grid
      backgroundCss = `
        html {
          background: hsl(var(--background)) !important;
          background-image: none !important;
        }
        body {
          background: transparent !important;
          background-image: none !important;
        }
      `
    }
  } else if (bgType === 'image' && preferences?.backgroundImageUrl) {
    const imageUrl = (preferences.backgroundImageUrl as string).replace(/[<>'"]/g, '')
    backgroundCss = `
      html, body {
        background-image: url("${imageUrl}") !important;
        background-color: transparent !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        background-attachment: fixed !important;
      }
      body.grid-pattern, html.grid-pattern, .grid-pattern,
      *[class*="grid-pattern"] {
        background-image: url("${imageUrl}") !important;
        background-color: transparent !important;
      }
      .bg-slate-50, .bg-slate-900, .dark\\:bg-slate-900,
      [class*="bg-slate"], section.bg-slate-50, section.bg-slate-900,
      section[class*="bg-slate"], div.bg-slate-50, div.bg-slate-900,
      div[class*="bg-slate"], div.bg-background, section.bg-background {
        background-color: transparent !important;
        background: transparent !important;
      }
    `
  } else {
    // Fallback to grid
    backgroundCss = `
      html {
        background: hsl(var(--background)) !important;
        background-image: none !important;
      }
      body {
        background: transparent !important;
        background-image: none !important;
      }
    `
  }
  
  // Headers now use floating bar styling with Tailwind classes
  // No need to override with CSS since we're using bg-teamy-primary/90 with backdrop-blur
  
  return backgroundCss
}

function generateBodyClass(preferences: Record<string, unknown> | null): string {
  const bgType = preferences?.backgroundType as string | undefined
  const isGrid = !bgType || bgType === 'grid'
  return isGrid ? 'grid-pattern' : ''
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch user preferences server-side
  let preferences: Record<string, unknown> | null = null
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
      })
      preferences = (user?.preferences as Record<string, unknown>) || null
    }
  } catch (error) {
    // Silently fail - will default to grid pattern
    console.error('Error fetching user preferences in layout:', error)
  }

  const backgroundStyles = generateBackgroundStyles(preferences)
  const bodyClass = generateBodyClass(preferences)
  
  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <body className={`font-sans antialiased ${bodyClass}`} suppressHydrationWarning>
        {/* Critical blocking script: Apply styles immediately before any rendering */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Apply theme first - this modifies html element which has suppressHydrationWarning
                  var theme = localStorage.getItem('theme');
                  var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  var resolvedTheme = theme || systemTheme;
                  if (resolvedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  
                  // Immediately inject background styles into head before any paint
                  // Check if style already exists to avoid duplicates
                  var existingStyle = document.getElementById('user-background-styles-inline');
                  if (!existingStyle) {
                    var style = document.createElement('style');
                    style.id = 'user-background-styles-inline';
                    style.textContent = ${JSON.stringify(backgroundStyles)};
                    (document.head || document.getElementsByTagName('head')[0] || document.documentElement).appendChild(style);
                  }
                } catch (e) {
                  console.error('Error applying initial styles:', e);
                }
              })();
            `,
          }}
        />
        {/* Also include style tag for SSR/hydration compatibility */}
        <style
          dangerouslySetInnerHTML={{
            __html: backgroundStyles,
          }}
        />
        <FaviconLoader />
        <Providers>
          {children}
          <Toaster />
          <SpeedInsights />
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}
