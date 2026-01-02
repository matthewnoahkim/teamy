'use client'

import { useState, useEffect } from 'react'
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

export function DiscordBanner({ initialSettings }: DiscordBannerProps) {
  // Initialize dismissed state immediately from localStorage
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('banner-dismissed')
    }
    return false
  })
  const [settings, setSettings] = useState<BannerSettings>(
    initialSettings || {
      enabled: true,
      text: 'This website is still a work in progress! Please report any issues to teamysite@gmail.com',
      link: '',
      backgroundColor: '#5865F2',
    }
  )
  
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
          backgroundColor: bgData.setting?.value || '#5865F2',
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
    setDismissed(true)
    localStorage.setItem('banner-dismissed', 'true')
  }

  if (dismissed || !settings.enabled) return null

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

