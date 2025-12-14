'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

export function UserBackgroundApplier() {
  const { data: session, status } = useSession()

  useEffect(() => {
    // Create or get style element
    let styleEl = document.getElementById('user-background-styles') as HTMLStyleElement | null
    
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'user-background-styles'
      document.head.appendChild(styleEl)
    }

    const applyBackground = async () => {
      try {
        // Default: reset everything
        let css = `
          :root {
            --user-background: none;
            --user-background-image: none;
          }
          body,
          html {
            background: var(--user-background) !important;
            background-image: var(--user-background-image) !important;
          }
          body {
            background-attachment: fixed !important;
            background-size: cover !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
          }
        `

        if (status !== 'authenticated' || !session?.user?.id) {
          styleEl!.textContent = css + `
            body {
              background: transparent !important;
              background-image: none !important;
            }
          `
          document.body.classList.add('grid-pattern')
          return
        }

        const response = await fetch('/api/user/preferences')
        if (!response.ok) {
          styleEl!.textContent = css + `
            body {
              background: transparent !important;
              background-image: none !important;
            }
          `
          document.body.classList.add('grid-pattern')
          return
        }

        const data = await response.json()
        const preferences = data.preferences as Record<string, unknown> | null

        if (!preferences || !preferences.backgroundType) {
          styleEl!.textContent = css + `
            body {
              background: transparent !important;
              background-image: none !important;
            }
          `
          document.body.classList.add('grid-pattern')
          return
        }

        const bgType = (preferences.backgroundType as string) || 'grid'
        document.body.classList.remove('grid-pattern')

        if (bgType === 'grid') {
          styleEl!.textContent = css + `
            body {
              background: transparent !important;
              background-image: none !important;
            }
          `
          document.body.classList.add('grid-pattern')
        } else if (bgType === 'solid' && preferences.backgroundColor) {
          const color = preferences.backgroundColor as string
          styleEl!.textContent = css.replace(
            '--user-background: none;',
            `--user-background: ${color};`
          ) + `
            body,
            html {
              background: ${color} !important;
              background-attachment: fixed !important;
            }
            .bg-slate-50,
            .bg-slate-900,
            .dark\\:bg-slate-900,
            [class*="bg-slate"] {
              background-color: transparent !important;
            }
          `
        } else if (bgType === 'gradient') {
          const gradientColors = (preferences.gradientColors as string[]) || []
          if (gradientColors.length >= 2) {
            const gradientStops = gradientColors
              .map((color, index) => `${color} ${(index / (gradientColors.length - 1)) * 100}%`)
              .join(', ')
            const direction = (preferences.gradientDirection as string) || '135deg'
            const gradient = `linear-gradient(${direction}, ${gradientStops})`
            styleEl!.textContent = css.replace(
              '--user-background: none;',
              `--user-background: ${gradient};`
            ) + `
              body,
              html {
                background: ${gradient} !important;
                background-attachment: fixed !important;
              }
              .bg-slate-50,
              .bg-slate-900,
              .dark\\:bg-slate-900,
              [class*="bg-slate"] {
                background-color: transparent !important;
              }
            `
          } else {
            styleEl!.textContent = css + `
              body {
                background: transparent !important;
                background-image: none !important;
              }
            `
            document.body.classList.add('grid-pattern')
          }
        } else if (bgType === 'image' && preferences.backgroundImageUrl) {
          const imageUrl = preferences.backgroundImageUrl as string
          styleEl!.textContent = css.replace(
            '--user-background-image: none;',
            `--user-background-image: url(${imageUrl});`
          ) + `
            body,
            html {
              background-image: url(${imageUrl}) !important;
              background-color: transparent !important;
              background-size: cover !important;
              background-position: center !important;
              background-repeat: no-repeat !important;
              background-attachment: fixed !important;
            }
            .bg-slate-50,
            .bg-slate-900,
            .dark\\:bg-slate-900,
            [class*="bg-slate"] {
              background-color: transparent !important;
            }
          `
        } else {
          styleEl!.textContent = css + `
            body {
              background: transparent !important;
              background-image: none !important;
            }
          `
          document.body.classList.add('grid-pattern')
        }
      } catch (error) {
        console.error('Error applying user background:', error)
        styleEl!.textContent = `
          body {
            background: transparent !important;
            background-image: none !important;
          }
        `
        document.body.classList.add('grid-pattern')
      }
    }

    applyBackground()

    // Listen for custom event to update background when changed
    const handleBackgroundUpdate = () => {
      applyBackground()
    }
    window.addEventListener('userBackgroundUpdated', handleBackgroundUpdate)

    // Listen for focus to refresh background
    const handleFocus = () => {
      applyBackground()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('userBackgroundUpdated', handleBackgroundUpdate)
      window.removeEventListener('focus', handleFocus)
    }
  }, [session?.user?.id, status])

  return null
}
