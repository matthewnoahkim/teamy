'use client'

import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import Link from 'next/link'

interface BannerSettings {
  enabled: boolean
  text: string
  link: string
  backgroundColor: string
}

interface DiscordBannerProps {
  initialSettings?: BannerSettings
}

// Generate a hash from banner content to create a unique ID
function generateBannerId(text: string, backgroundColor: string, link: string): string {
  const content = `${text}|${backgroundColor}|${link}`
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `banner-${Math.abs(hash).toString(36)}`
}

// Get dismissed banner IDs from localStorage
function getDismissedBannerIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('banner-dismissed-ids')
    if (!stored) return []
    return JSON.parse(stored)
  } catch {
    return []
  }
}

// Add a banner ID to the dismissed list
function dismissBannerId(bannerId: string): void {
  if (typeof window === 'undefined') return
  try {
    const dismissed = getDismissedBannerIds()
    if (!dismissed.includes(bannerId)) {
      dismissed.push(bannerId)
      localStorage.setItem('banner-dismissed-ids', JSON.stringify(dismissed))
    }
  } catch (error) {
    console.error('Failed to save dismissed banner ID:', error)
  }
}

export function DiscordBanner({ initialSettings }: DiscordBannerProps) {
  const [settings, setSettings] = useState<BannerSettings>(
    initialSettings || {
      enabled: true,
      text: 'This website is still a work in progress! Please report any issues to teamysite@gmail.com',
      link: '',
      backgroundColor: '#8B5CF6',
    }
  )
  
  // Generate banner ID from current settings
  const bannerId = useMemo(() => 
    generateBannerId(settings.text, settings.backgroundColor, settings.link),
    [settings.text, settings.backgroundColor, settings.link]
  )

  // Track if component has mounted to prevent hydration mismatch
  const [mounted, setMounted] = useState(false)
  const [isDismissed, setIsDismissed] = useState(true) // Start as true to prevent flash

  // Check dismissal state after mounting and when banner ID changes
  useEffect(() => {
    setMounted(true)
    const dismissed = getDismissedBannerIds()
    setIsDismissed(dismissed.includes(bannerId))
  }, [bannerId])

  useEffect(() => {
    // Skip API call if initialSettings were provided (server-side rendered)
    if (initialSettings) {
      return
    }

    const fetchSettings = async () => {
      try {
        // Fetch banner settings from the API
        const [enabledRes, textRes, linkRes, bgRes] = await Promise.all([
          fetch('/api/dev/site-settings?key=banner_enabled'),
          fetch('/api/dev/site-settings?key=banner_text'),
          fetch('/api/dev/site-settings?key=banner_link'),
          fetch('/api/dev/site-settings?key=banner_background_color'),
        ])

        const [enabledData, textData, linkData, bgData] = await Promise.all([
          enabledRes.json(),
          textRes.json(),
          linkRes.json(),
          bgRes.json(),
        ])

        const bannerSettings: BannerSettings = {
          enabled: enabledData.setting?.value === 'true',
          text: textData.setting?.value || 'This website is still a work in progress! Please report any issues to teamysite@gmail.com',
          link: linkData.setting?.value || '',
          backgroundColor: bgData.setting?.value || '#8B5CF6',
        }

        setSettings(bannerSettings)
      } catch (error) {
        console.error('Failed to fetch banner settings:', error)
        // Keep default settings on error
      }
    }

    fetchSettings()
  }, [initialSettings])

  const handleDismiss = () => {
    dismissBannerId(bannerId)
    setIsDismissed(true)
  }

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted || isDismissed || !settings.enabled) return null

  const BannerContent = () => (
    <span className="font-medium">{settings.text}</span>
  )

  return (
    <div 
      className="text-white py-2 px-4 text-center text-sm relative"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      {settings.link ? (
        <Link 
          href={settings.link}
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:underline"
        >
          <BannerContent />
        </Link>
      ) : (
        <BannerContent />
      )}
      <button 
        onClick={handleDismiss}
        className="absolute right-4 top-1/2 -translate-y-1/2 hover:bg-white/20 rounded p-1 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

