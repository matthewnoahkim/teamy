'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useUserPreferences } from '@/hooks/use-user-preferences'

const USER_BACKGROUND_CACHE_KEY = 'teamy.user-background.preferences.v1'
const USER_BACKGROUND_AUTH_KEY = 'teamy.user-background.auth.v1'

export function UserBackgroundApplier() {
  const { data: session, status } = useSession()
  const { theme, setTheme } = useTheme()
  const lastSyncedThemeRef = useRef<string | null>(null)
  const { data: userPreferencesData, refetch: refetchUserPreferences } = useUserPreferences({
    enabled: status === 'authenticated' && Boolean(session?.user?.id),
  })

  useEffect(() => {
    // Use the same style element that was created by the server-side script, or create a new one
    let styleEl = document.getElementById('user-background-styles-inline') as HTMLStyleElement | null
    
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'user-background-styles-inline'
      document.head.appendChild(styleEl)
    }

    const cacheBackgroundPreferences = (preferences: Record<string, unknown> | null) => {
      try {
        const cachePayload = {
          backgroundType:
            typeof preferences?.backgroundType === 'string'
              ? preferences.backgroundType
              : 'grid',
          backgroundColor:
            typeof preferences?.backgroundColor === 'string'
              ? preferences.backgroundColor
              : null,
          gradientColors: Array.isArray(preferences?.gradientColors)
            ? preferences.gradientColors
            : [],
          gradientDirection:
            typeof preferences?.gradientDirection === 'string'
              ? preferences.gradientDirection
              : '135deg',
          backgroundImageUrl:
            typeof preferences?.backgroundImageUrl === 'string'
              ? preferences.backgroundImageUrl
              : null,
          updatedAt: Date.now(),
        }

        localStorage.setItem(
          USER_BACKGROUND_CACHE_KEY,
          JSON.stringify(cachePayload)
        )
        localStorage.setItem(USER_BACKGROUND_AUTH_KEY, '1')
      } catch {
        // Ignore localStorage write failures (e.g., private mode restrictions).
      }
    }

    const clearBackgroundCache = () => {
      try {
        localStorage.removeItem(USER_BACKGROUND_CACHE_KEY)
        localStorage.setItem(USER_BACKGROUND_AUTH_KEY, '0')
      } catch {
        // Ignore localStorage write failures (e.g., private mode restrictions).
      }
    }

    const applyBackground = () => {
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
        const css = `
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

        if (status === 'loading') {
          return
        }

        if (status !== 'authenticated' || !session?.user?.id) {
          lastSyncedThemeRef.current = null
          clearBackgroundCache()
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

        const preferences = userPreferencesData?.preferences as Record<string, unknown> | null | undefined
        if (preferences === undefined) {
          // Keep whichever background is already applied (usually from bootstrap cache)
          // until shared user preferences are available.
          return
        }

        // Sync theme from account preferences so it follows the user across browser profiles/devices
        const savedTheme = preferences?.theme as string | undefined
        if (savedTheme === 'light' || savedTheme === 'dark') {
          // Only sync when the server-provided theme value changes.
          // This prevents stale preference data from overriding a live user toggle.
          if (lastSyncedThemeRef.current !== savedTheme) {
            lastSyncedThemeRef.current = savedTheme
            if (theme !== savedTheme) {
              setTheme(savedTheme)
            }
          }
        }
        cacheBackgroundPreferences(preferences)

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
        if (status !== 'authenticated' || !session?.user?.id) {
          clearBackgroundCache()
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
    }

    applyBackground()

    // Listen for custom event to update background when changed
    const handleBackgroundUpdate = () => {
      void refetchUserPreferences()
    }
    window.addEventListener('userBackgroundUpdated', handleBackgroundUpdate)

    // Listen for focus to refresh background
    const handleFocus = () => {
      if (status === 'authenticated' && session?.user?.id) {
        void refetchUserPreferences()
      } else {
        applyBackground()
      }
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('userBackgroundUpdated', handleBackgroundUpdate)
      window.removeEventListener('focus', handleFocus)
    }
  }, [refetchUserPreferences, session?.user?.id, status, theme, setTheme, userPreferencesData?.preferences])

  return null
}
