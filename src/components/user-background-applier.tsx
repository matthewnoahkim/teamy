'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

export function UserBackgroundApplier() {
  const { data: session, status } = useSession()

  useEffect(() => {
    // Use the same style element that was created by the server-side script, or create a new one
    let styleEl = document.getElementById('user-background-styles-inline') as HTMLStyleElement | null
    
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'user-background-styles-inline'
      document.head.appendChild(styleEl)
    }

    const applyBackground = async () => {
      // Always enforce header static background - defined outside try block so it's accessible in catch
      const headerCss = `
        header,
        header.bg-teamy-primary,
        header[class*="bg-teamy-primary"] {
          background-color: #0056C7 !important;
          background-image: none !important;
          background: #0056C7 !important;
        }
        .dark header,
        .dark header.bg-teamy-primary,
        .dark header[class*="bg-teamy-primary"],
        html.dark header,
        html.dark header.bg-teamy-primary {
          background-color: rgb(15 23 42) !important;
          background-image: none !important;
          background: rgb(15 23 42) !important;
        }
      `
      
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
          styleEl!.textContent = headerCss + `
            html {
              background-color: hsl(var(--background)) !important;
              background-image: none !important;
            }
            body {
              background-color: transparent !important;
              background-attachment: fixed !important;
              background-size: 24px 24px !important;
              background-position: 0 0 !important;
              background-repeat: repeat !important;
            }
            body.grid-pattern {
              background-image: 
                linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;
            }
            .dark body.grid-pattern {
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;
            }
          `
          document.body.classList.add('grid-pattern')
          return
        }

        const response = await fetch('/api/user/preferences')
        if (!response.ok) {
          styleEl!.textContent = headerCss + `
            html {
              background-color: hsl(var(--background)) !important;
              background-image: none !important;
            }
            body {
              background-color: transparent !important;
              background-attachment: fixed !important;
              background-size: 24px 24px !important;
              background-position: 0 0 !important;
              background-repeat: repeat !important;
            }
            body.grid-pattern {
              background-image: 
                linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;
            }
            .dark body.grid-pattern {
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;
            }
          `
          document.body.classList.add('grid-pattern')
          return
        }

        const data = await response.json()
        const preferences = data.preferences as Record<string, unknown> | null

        if (!preferences || !preferences.backgroundType) {
          styleEl!.textContent = headerCss + `
            html {
              background-color: hsl(var(--background)) !important;
              background-image: none !important;
            }
            body {
              background-color: transparent !important;
              background-attachment: fixed !important;
              background-size: 24px 24px !important;
              background-position: 0 0 !important;
              background-repeat: repeat !important;
            }
            body.grid-pattern {
              background-image: 
                linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;
            }
            .dark body.grid-pattern {
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;
            }
          `
          document.body.classList.add('grid-pattern')
          return
        }

        const bgType = (preferences.backgroundType as string) || 'grid'
        document.body.classList.remove('grid-pattern')

        if (bgType === 'grid') {
          styleEl!.textContent = headerCss + `
            :root {
              --user-background: none;
              --user-background-image: none;
            }
            html {
              background-color: hsl(var(--background)) !important;
              background-image: none !important;
            }
            body {
              background-color: transparent !important;
              background-attachment: fixed !important;
              background-size: 24px 24px !important;
              background-position: 0 0 !important;
              background-repeat: repeat !important;
            }
            body.grid-pattern {
              background-image: 
                linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;
            }
            .dark body.grid-pattern {
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;
            }
          `
          document.body.classList.add('grid-pattern')
        } else if (bgType === 'solid' && preferences.backgroundColor) {
          const color = preferences.backgroundColor as string
          styleEl!.textContent = headerCss + css.replace(
            '--user-background: none;',
            `--user-background: ${color};`
          ) + `
            body,
            html,
            body.grid-pattern,
            html.grid-pattern,
            .grid-pattern,
            *[class*="grid-pattern"] {
              background: ${color} !important;
              background-image: none !important;
              background-attachment: fixed !important;
            }
            .bg-slate-50,
            .bg-slate-900,
            .dark\\:bg-slate-900,
            [class*="bg-slate"],
            section.bg-slate-50,
            section.bg-slate-900,
            section[class*="bg-slate"],
            div.bg-slate-50,
            div.bg-slate-900,
            div[class*="bg-slate"],
            div.bg-background,
            section.bg-background {
              background-color: transparent !important;
              background: transparent !important;
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
            styleEl!.textContent = headerCss + css.replace(
              '--user-background: none;',
              `--user-background: ${gradient};`
            ) + `
              body,
              html,
              body.grid-pattern,
              html.grid-pattern,
              .grid-pattern,
              *[class*="grid-pattern"] {
                background: ${gradient} !important;
                background-image: ${gradient} !important;
                background-attachment: fixed !important;
              }
              .bg-slate-50,
              .bg-slate-900,
              .dark\\:bg-slate-900,
              [class*="bg-slate"],
              section.bg-slate-50,
              section.bg-slate-900,
              section[class*="bg-slate"],
              div.bg-slate-50,
              div.bg-slate-900,
              div[class*="bg-slate"],
              div.bg-background,
              section.bg-background {
                background-color: transparent !important;
                background: transparent !important;
              }
            `
          } else {
            styleEl!.textContent = headerCss + `
              html {
                background-color: hsl(var(--background)) !important;
                background-image: none !important;
              }
              body {
                background-color: transparent !important;
                background-attachment: fixed !important;
                background-size: 24px 24px !important;
                background-position: 0 0 !important;
                background-repeat: repeat !important;
              }
              body.grid-pattern {
                background-image: 
                  linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;
              }
              .dark body.grid-pattern {
                background-image: 
                  linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;
              }
            `
            document.body.classList.add('grid-pattern')
          }
        } else if (bgType === 'image' && preferences.backgroundImageUrl) {
          const imageUrl = preferences.backgroundImageUrl as string
          styleEl!.textContent = headerCss + css.replace(
            '--user-background-image: none;',
            `--user-background-image: url(${imageUrl});`
          ) + `
            body,
            html,
            body.grid-pattern,
            html.grid-pattern,
            .grid-pattern,
            *[class*="grid-pattern"] {
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
            [class*="bg-slate"],
            section.bg-slate-50,
            section.bg-slate-900,
            section[class*="bg-slate"],
            div.bg-slate-50,
            div.bg-slate-900,
            div[class*="bg-slate"],
            div.bg-background,
            section.bg-background {
              background-color: transparent !important;
              background: transparent !important;
            }
          `
        } else {
          styleEl!.textContent = headerCss + `
            html {
              background-color: hsl(var(--background)) !important;
              background-image: none !important;
            }
            body {
              background-color: transparent !important;
              background-attachment: fixed !important;
              background-size: 24px 24px !important;
              background-position: 0 0 !important;
              background-repeat: repeat !important;
            }
            body.grid-pattern {
              background-image: 
                linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;
            }
            .dark body.grid-pattern {
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;
            }
          `
          document.body.classList.add('grid-pattern')
        }
      } catch (error) {
        console.error('Error applying user background:', error)
        styleEl!.textContent = headerCss + `
          html {
            background-color: hsl(var(--background)) !important;
            background-image: none !important;
          }
          body {
            background-color: transparent !important;
            background-attachment: fixed !important;
            background-size: 24px 24px !important;
            background-position: 0 0 !important;
            background-repeat: repeat !important;
          }
          body.grid-pattern {
            background-image: 
              linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px) !important;
          }
          .dark body.grid-pattern {
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;
          }
        `
        document.body.classList.add('grid-pattern')
      }
    }

    // Use requestAnimationFrame to ensure DOM is ready and hydration is complete
    const rafId = requestAnimationFrame(() => {
      applyBackground()
    })

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
      cancelAnimationFrame(rafId)
      window.removeEventListener('userBackgroundUpdated', handleBackgroundUpdate)
      window.removeEventListener('focus', handleFocus)
    }
  }, [session?.user?.id, status])

  return null
}
