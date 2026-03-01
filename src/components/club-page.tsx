'use client'

import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Home, MessageSquare, Users, Calendar, Settings, ClipboardCheck, DollarSign, FileText, Pencil, Image, File, Menu, CheckSquare, BarChart3, Wrench } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { PageLoading } from '@/components/ui/loading-spinner'
import dynamic from 'next/dynamic'

// Lazy load heavy tab components for better initial load performance
const HomePageTab = dynamic(() => import('@/components/tabs/homepage-tab').then(mod => ({ default: mod.HomePageTab })), {
  loading: () => <PageLoading title="Loading dashboard" description="Preparing widgets and updates..." variant="orbit" />
})
const StreamTab = dynamic(() => import('@/components/tabs/stream-tab').then(mod => ({ default: mod.StreamTab })), {
  loading: () => <PageLoading title="Loading stream" description="Fetching announcements and posts..." variant="orbit" />
})
const PeopleTab = dynamic(() => import('@/components/tabs/people-tab').then(mod => ({ default: mod.PeopleTab })), {
  loading: () => <PageLoading title="Loading people" description="Fetching club members and rosters..." variant="orbit" />
})
const CalendarTab = dynamic(() => import('@/components/tabs/calendar-tab').then(mod => ({ default: mod.CalendarTab })), {
  loading: () => <PageLoading title="Loading calendar" description="Fetching events and schedules..." variant="orbit" />
})
const AttendanceTab = dynamic(() => import('@/components/tabs/attendance-tab').then(mod => ({ default: mod.AttendanceTab })), {
  loading: () => <PageLoading title="Loading attendance" description="Fetching attendance records..." variant="orbit" />
})
const SettingsTab = dynamic(() => import('@/components/tabs/settings-tab').then(mod => ({ default: mod.SettingsTab })), {
  loading: () => <PageLoading title="Loading settings" description="Fetching club configuration..." variant="orbit" />
})
const FinanceTab = dynamic(() => import('@/components/tabs/finance-tab'), {
  loading: () => <PageLoading title="Loading finance" description="Fetching expenses and budgets..." variant="orbit" />
})
const TestsTab = dynamic(() => import('@/components/tabs/tests-tab'), {
  loading: () => <PageLoading title="Loading tests" description="Fetching assessments and submissions..." variant="orbit" />
})
const GalleryTab = dynamic(() => import('@/components/tabs/gallery-tab').then(mod => ({ default: mod.GalleryTab })), {
  loading: () => <PageLoading title="Loading gallery" description="Fetching photos and videos..." variant="orbit" />
})
const PaperworkTab = dynamic(() => import('@/components/tabs/paperwork-tab').then(mod => ({ default: mod.PaperworkTab })), {
  loading: () => <PageLoading title="Loading paperwork" description="Fetching forms and submissions..." variant="orbit" />
})
const TodoTab = dynamic(() => import('@/components/tabs/todo-tab').then(mod => ({ default: mod.TodoTab })), {
  loading: () => <PageLoading title="Loading to-do list" description="Fetching tasks and reminders..." variant="orbit" />
})
const StatsTab = dynamic(() => import('@/components/tabs/stats-tab').then(mod => ({ default: mod.StatsTab })).catch(() => ({ default: () => <div>Failed to load stats tab</div> })), {
  loading: () => <PageLoading title="Loading stats" description="Fetching analytics and insights..." variant="orbit" />
})
const ToolsTab = dynamic(() => import('@/components/tabs/tools-tab').then(mod => ({ default: mod.ToolsTab })), {
  loading: () => <PageLoading title="Loading tools" description="Preparing study tools..." variant="orbit" />
})
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useFaviconBadge } from '@/hooks/use-favicon-badge'
import type {
  ClubWithMembers,
  ClubWithMembersLite,
  MembershipWithPreferences,
  SessionUser,
  ClubPageInitialData,
} from '@/types/models'
import type { CalendarEvent } from '@/components/tabs/calendar-tab'
import type { Expense, PurchaseRequest, EventBudget, Team } from '@/components/tabs/finance-tab'
import type { MediaItem, Album } from '@/components/tabs/gallery-tab'
import type { PaperworkForm } from '@/components/tabs/paperwork-tab'
import type { Todo } from '@/components/tabs/todo-tab'
import type { BackgroundPreferences } from '@/components/tabs/settings-tab'
import type { StatsTabInitialStats } from '@/components/tabs/stats-tab'

/** Pulsing notification dot for tab buttons with unread content */
const NotificationDot = memo(function NotificationDot() {
  return (
    <span className="absolute right-3 top-1/2 -translate-y-1/2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
    </span>
  )
})

interface ClubPageProps {
  club: ClubWithMembers | ClubWithMembersLite
  currentMembership: MembershipWithPreferences
  user: SessionUser
  clubs?: Array<{ id: string; name: string }>
  initialData?: Partial<ClubPageInitialData>
  initialInviteCodes?: { adminCode: string; memberCode: string } | null
}

const TAB_DETAILS = {
  home: {
    title: 'Home',
    description: 'Overview of announcements, upcoming items, and team activity.',
  },
  stream: {
    title: 'Stream',
    description: 'Post updates and keep club communication organized in one place.',
  },
  people: {
    title: 'People',
    description: 'Manage members, roles, and team assignments.',
  },
  calendar: {
    title: 'Calendar',
    description: 'Plan practices, meetings, and key deadlines.',
  },
  attendance: {
    title: 'Attendance',
    description: 'Track participation and review attendance trends.',
  },
  finance: {
    title: 'Finance',
    description: 'Monitor budgets, requests, and club spending.',
  },
  tests: {
    title: 'Tests',
    description: 'Create, schedule, and review assessments.',
  },
  gallery: {
    title: 'Gallery',
    description: 'Organize club photos and media.',
  },
  paperwork: {
    title: 'Paperwork',
    description: 'Collect forms and manage submission status.',
  },
  todos: {
    title: 'To-Do List',
    description: 'Coordinate tasks and follow through on action items.',
  },
  tools: {
    title: 'Tools',
    description: 'Access calculators, resources, and study utilities.',
  },
  stats: {
    title: 'Stats & Analytics',
    description: 'Review performance and usage insights.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure club preferences, branding, and defaults.',
  },
} satisfies Record<string, { title: string; description: string }>

type ClubTab = keyof typeof TAB_DETAILS
const NOTIFICATION_TABS = ['stream', 'calendar', 'attendance', 'finance', 'tests', 'people'] as const
type NotificationTab = (typeof NOTIFICATION_TABS)[number]
const NOTIFICATION_TAB_SET = new Set<string>(NOTIFICATION_TABS)
const NOTIFICATION_SYNC_CHANNEL = 'club-notification-seen-sync'

function parseTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isClubTab(tab: string): tab is ClubTab {
  return tab in TAB_DETAILS
}

function resolveTab(tab: string | null, isAdmin: boolean): ClubTab {
  if (!tab || !isClubTab(tab)) return 'home'
  if (tab === 'stats' && !isAdmin) return 'home'
  return tab
}

export function ClubPage({ club, currentMembership, user, clubs, initialData, initialInviteCodes }: ClubPageProps) {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const isAdmin = currentMembership.role === 'ADMIN'
  const [activeTab, setActiveTab] = useState<ClubTab>(() => resolveTab(searchParams.get('tab'), isAdmin))
  const [editClubNameOpen, setEditClubNameOpen] = useState(false)
  const [currentClubName, setCurrentClubName] = useState(club.name)
  const [newClubName, setNewClubName] = useState(club.name)
  const [updatingClubName, setUpdatingClubName] = useState(false)
  const [tabNotifications, setTabNotifications] = useState<Record<string, boolean>>({})
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [personalBackground, setPersonalBackground] = useState(currentMembership.preferences ?? null)
  const notificationSyncChannelRef = useRef<BroadcastChannel | null>(null)
  const DEFAULT_BACKGROUND = {
    backgroundType: 'grid',
    backgroundColor: '#f8fafc',
    gradientStartColor: '#e0e7ff',
    gradientEndColor: '#fce7f3',
    gradientColors: [] as string[],
    gradientDirection: null as string | null,
    backgroundImageUrl: null as string | null,
  }

  const isNotificationTab = useCallback((tab: string): tab is NotificationTab => {
    return NOTIFICATION_TAB_SET.has(tab)
  }, [])

  const getTabSeenStorageKey = useCallback((tab: string) => {
    return `lastCleared_${club.id}_${tab}_${user.id}`
  }, [club.id, user.id])

  const markTabNotificationSeen = useCallback((tab: string) => {
    setTabNotifications(prev => {
      if (!prev[tab]) return prev
      const updated = { ...prev, [tab]: false }
      const totalCount = Object.values(updated).filter(Boolean).length
      setTotalUnreadCount(totalCount)
      return updated
    })
  }, [])

  const persistTabSeenTime = useCallback((tab: string, seenAt?: Date): string | null => {
    if (typeof window === 'undefined') return null
    const key = getTabSeenStorageKey(tab)
    const timestamp = (seenAt ?? new Date()).toISOString()
    const previousSeenAt = parseTimestamp(localStorage.getItem(key))
    const nextSeenAt = parseTimestamp(timestamp)

    if (!nextSeenAt) return null
    if (!previousSeenAt || nextSeenAt.getTime() > previousSeenAt.getTime()) {
      localStorage.setItem(key, timestamp)
    }

    return timestamp
  }, [getTabSeenStorageKey])

  const syncSeenTimestampToServer = useCallback(async (tab: NotificationTab, seenAt: string) => {
    try {
      await fetch(`/api/clubs/${club.id}/notifications/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, seenAt }),
        keepalive: true,
      })
    } catch (error) {
      console.error('Failed to sync notification seen timestamp:', error)
    }
  }, [club.id])

  const broadcastTabSeen = useCallback((tab: NotificationTab, seenAt: string) => {
    notificationSyncChannelRef.current?.postMessage({
      type: 'tab-seen',
      tab,
      seenAt,
      clubId: club.id,
      userId: user.id,
    })
  }, [club.id, user.id])

  // Save current club as last visited
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.cookie = `lastVisitedClub=${club.id}; path=/; max-age=${60 * 60 * 24 * 365}` // 1 year
    }
  }, [club.id])

  useEffect(() => {
    setPersonalBackground(currentMembership.preferences ?? null)
  }, [currentMembership.preferences])

  // Update favicon badge with total unread count across all tabs
  useFaviconBadge(totalUnreadCount)

  // Get last cleared time for a tab from localStorage
  const getLastClearedTime = useCallback((tab: string): Date => {
    if (typeof window === 'undefined') return new Date(0)
    const key = getTabSeenStorageKey(tab)
    const stored = localStorage.getItem(key)
    if (stored) {
      return new Date(stored)
    }

    // New members should not inherit historical club activity as unread.
    const membershipCreatedAt = new Date(currentMembership.createdAt)
    return Number.isNaN(membershipCreatedAt.getTime()) ? new Date(0) : membershipCreatedAt
  }, [getTabSeenStorageKey, currentMembership.createdAt])

  // Clear notification for a tab when it's opened
  const clearTabNotification = useCallback((tab: string) => {
    const seenAt = persistTabSeenTime(tab)
    markTabNotificationSeen(tab)

    if (!seenAt || !isNotificationTab(tab)) return
    broadcastTabSeen(tab, seenAt)
    void syncSeenTimestampToServer(tab, seenAt)
  }, [broadcastTabSeen, isNotificationTab, markTabNotificationSeen, persistTabSeenTime, syncSeenTimestampToServer])

  const dismissTabNotification = useCallback((tab: string) => {
    markTabNotificationSeen(tab)
  }, [markTabNotificationSeen])

  const syncSeenFromServer = useCallback(async () => {
    try {
      const response = await fetch(`/api/clubs/${club.id}/notifications/seen`, { cache: 'no-store' })
      if (!response.ok) return

      const data = (await response.json()) as { seen?: Record<string, string> }
      const seenByTab = data.seen ?? {}

      for (const [tab, seenAtRaw] of Object.entries(seenByTab)) {
        if (!isNotificationTab(tab)) continue
        const seenAt = parseTimestamp(seenAtRaw)
        if (!seenAt) continue

        const localSeenAt = getLastClearedTime(tab)
        if (seenAt.getTime() <= localSeenAt.getTime()) continue

        persistTabSeenTime(tab, seenAt)
        markTabNotificationSeen(tab)
      }
    } catch (error) {
      console.error('Failed to sync notification seen timestamps:', error)
    }
  }, [club.id, getLastClearedTime, isNotificationTab, markTabNotificationSeen, persistTabSeenTime])

  // Keep active tab in a ref so polling interval doesn't restart during navigation.
  const activeTabRef = useRef(activeTab)
  const previousActiveTabRef = useRef<string | null>(null)
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Mark previous tab as seen when navigating away; just dismiss indicator for current tab.
  useEffect(() => {
    const previousTab = previousActiveTabRef.current
    if (previousTab && previousTab !== activeTab) {
      clearTabNotification(previousTab)
    }
    dismissTabNotification(activeTab)
    previousActiveTabRef.current = activeTab
  }, [activeTab, clearTabNotification, dismissTabNotification])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const keyPrefix = `lastCleared_${club.id}_`
    const keySuffix = `_${user.id}`

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || !event.key || !event.newValue) return
      if (!event.key.startsWith(keyPrefix) || !event.key.endsWith(keySuffix)) return

      const tab = event.key.slice(keyPrefix.length, event.key.length - keySuffix.length)
      if (!isNotificationTab(tab)) return
      markTabNotificationSeen(tab)
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [club.id, isNotificationTab, markTabNotificationSeen, user.id])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel(NOTIFICATION_SYNC_CHANNEL)
    notificationSyncChannelRef.current = channel

    const onMessage = (event: MessageEvent<unknown>) => {
      const payload = event.data
      if (!payload || typeof payload !== 'object') return

      const value = payload as {
        type?: string
        tab?: string
        seenAt?: string
        clubId?: string
        userId?: string
      }

      if (value.type !== 'tab-seen' || value.clubId !== club.id || value.userId !== user.id) return
      if (!value.tab || !isNotificationTab(value.tab)) return

      const seenAt = parseTimestamp(value.seenAt)
      if (seenAt) {
        persistTabSeenTime(value.tab, seenAt)
      }
      markTabNotificationSeen(value.tab)
    }

    channel.addEventListener('message', onMessage)
    return () => {
      channel.removeEventListener('message', onMessage)
      channel.close()
      if (notificationSyncChannelRef.current === channel) {
        notificationSyncChannelRef.current = null
      }
    }
  }, [club.id, isNotificationTab, markTabNotificationSeen, persistTabSeenTime, user.id])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncOnFocus = () => { void syncSeenFromServer() }
    window.addEventListener('focus', syncOnFocus)
    return () => {
      window.removeEventListener('focus', syncOnFocus)
    }
  }, [syncSeenFromServer])

  // Persist "seen" timestamp for the currently open tab when page is backgrounded/unloaded.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const persistCurrentTab = () => {
      const currentTab = activeTabRef.current
      if (!currentTab) return

      const seenAt = persistTabSeenTime(currentTab)
      if (!seenAt || !isNotificationTab(currentTab)) return

      const payload = JSON.stringify({ tab: currentTab, seenAt })
      const endpoint = `/api/clubs/${club.id}/notifications/seen`
      const usedBeacon =
        typeof navigator !== 'undefined' &&
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }))

      if (!usedBeacon) {
        void syncSeenTimestampToServer(currentTab, seenAt)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistCurrentTab()
      }
    }

    window.addEventListener('beforeunload', persistCurrentTab)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', persistCurrentTab)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [club.id, isNotificationTab, persistTabSeenTime, syncSeenTimestampToServer])

  // Check for new content with a single lightweight API call.
  useEffect(() => {
    let isMounted = true

    const checkForNewContent = async () => {
      if (!isMounted) return
      await syncSeenFromServer()
      const tabsToCheck = NOTIFICATION_TABS.filter(tab => tab !== activeTabRef.current)
      if (tabsToCheck.length === 0) return

      const query = new URLSearchParams()
      query.set('tabs', tabsToCheck.join(','))
      for (const tab of tabsToCheck) {
        query.set(`${tab}Since`, getLastClearedTime(tab).toISOString())
      }

      try {
        const response = await fetch(`/api/clubs/${club.id}/notifications?${query.toString()}`, {
          cache: 'no-store',
        })
        if (!response.ok) return

        const data = (await response.json()) as { notifications?: Record<string, boolean> }
        const notifications = data.notifications ?? {}

        if (!isMounted) return
        setTabNotifications(prev => {
          const updated = { ...prev, ...notifications }
          const totalCount = Object.values(updated).filter(Boolean).length
          setTotalUnreadCount(totalCount)
          return updated
        })
      } catch (error) {
        console.error('Failed to fetch tab notifications:', error)
      }
    }

    checkForNewContent()
    const interval = setInterval(checkForNewContent, 30000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [club.id, getLastClearedTime, syncSeenFromServer])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const resolvedTab = resolveTab(tabParam, isAdmin)

    setActiveTab(prev => (prev === resolvedTab ? prev : resolvedTab))

    if (tabParam && tabParam !== resolvedTab && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', resolvedTab)
      window.history.replaceState(window.history.state, '', url.pathname + url.search)
    }
  }, [searchParams, isAdmin])

  const handleTabChange = useCallback((newTab: ClubTab) => {
    dismissTabNotification(newTab)
    setActiveTab(newTab)
    setMobileMenuOpen(false)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', newTab)
      window.history.replaceState(window.history.state, '', url.pathname + url.search)
    }
  }, [dismissTabNotification])

  const hasUnread = useCallback((tab: string) => {
    return Boolean(tabNotifications[tab] && activeTab !== tab)
  }, [tabNotifications, activeTab])

  const handleUpdateClubName = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newClubName.trim()) {
      toast({
        title: 'Error',
        description: 'Club name cannot be empty',
        variant: 'destructive',
      })
      return
    }

    setUpdatingClubName(true)

    try {
      const response = await fetch(`/api/clubs/${club.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClubName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update club name')
      }

      toast({
        title: 'Club name updated',
        description: `Club name changed to "${newClubName.trim()}"`,
      })

      setCurrentClubName(newClubName.trim())
      setEditClubNameOpen(false)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update club name'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setUpdatingClubName(false)
    }
  }

  const handleBackgroundUpdate = (prefs: MembershipWithPreferences['preferences'] | null) => {
    setPersonalBackground(prefs)
  }

  const resolvedBackgroundSource =
    personalBackground?.backgroundType ? personalBackground : DEFAULT_BACKGROUND

  // Memoize background style calculation to avoid recomputing on every render
  const backgroundStyle = useMemo(() => {
    const bgType = resolvedBackgroundSource.backgroundType || 'grid'
    
    if (bgType === 'solid' && resolvedBackgroundSource.backgroundColor) {
      return {
        background: resolvedBackgroundSource.backgroundColor,
        backgroundAttachment: 'fixed',
      }
    } else if (bgType === 'gradient') {
      let gradientColors: string[] = []
      if (resolvedBackgroundSource.gradientColors && resolvedBackgroundSource.gradientColors.length > 0) {
        gradientColors = resolvedBackgroundSource.gradientColors
      } else if (resolvedBackgroundSource.gradientStartColor && resolvedBackgroundSource.gradientEndColor) {
        gradientColors = [resolvedBackgroundSource.gradientStartColor, resolvedBackgroundSource.gradientEndColor]
      }
      
      if (gradientColors.length >= 2) {
        const gradientStops = gradientColors.map((color, index) => 
          `${color} ${(index / (gradientColors.length - 1)) * 100}%`
        ).join(', ')
        const direction = resolvedBackgroundSource.gradientDirection || '135deg'
        return {
          background: `linear-gradient(${direction}, ${gradientStops})`,
          backgroundAttachment: 'fixed',
        }
      }
    } else if (bgType === 'image' && resolvedBackgroundSource.backgroundImageUrl) {
      return {
        backgroundImage: `url(${resolvedBackgroundSource.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }
    }
    
    return {}
  }, [resolvedBackgroundSource])

  const effectiveBgType = resolvedBackgroundSource.backgroundType || 'grid'
  const _showGridPattern = effectiveBgType === 'grid'

  // Memoize navigation buttons to prevent recreation on every render
  const renderNavigationButtons = useCallback(() => (
    <>
      <Button
        variant={activeTab === 'home' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('home')}
      >
        <Home className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Home
      </Button>
      <Button
        variant={activeTab === 'stream' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('stream')}
      >
        <MessageSquare className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Stream
        {hasUnread('stream') && <NotificationDot />}
      </Button>
      <Button
        variant={activeTab === 'people' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('people')}
      >
        <Users className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        People
        {hasUnread('people') && <NotificationDot />}
      </Button>
      <Button
        variant={activeTab === 'calendar' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('calendar')}
      >
        <Calendar className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Calendar
        {hasUnread('calendar') && <NotificationDot />}
      </Button>
      <Button
        variant={activeTab === 'attendance' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('attendance')}
      >
        <ClipboardCheck className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Attendance
        {hasUnread('attendance') && <NotificationDot />}
      </Button>
      <Button
        variant={activeTab === 'finance' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('finance')}
      >
        <DollarSign className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Finance
        {hasUnread('finance') && <NotificationDot />}
      </Button>
      <Button
        variant={activeTab === 'tests' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('tests')}
      >
        <FileText className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Tests
        {hasUnread('tests') && <NotificationDot />}
      </Button>
      <Button
        variant={activeTab === 'gallery' ? 'default' : 'ghost'}
        className="w-full justify-start text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('gallery')}
      >
        <Image className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Gallery
      </Button>
      <Button
        variant={activeTab === 'paperwork' ? 'default' : 'ghost'}
        className="w-full justify-start text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('paperwork')}
      >
        <File className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Paperwork
      </Button>
      <Button
        variant={activeTab === 'todos' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('todos')}
      >
        <CheckSquare className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        To-Do List
        {hasUnread('todos') && <NotificationDot />}
      </Button>
      <Button
        variant={activeTab === 'tools' ? 'default' : 'ghost'}
        className="w-full justify-start text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('tools')}
      >
        <Wrench className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Tools
      </Button>
      <div className="h-px bg-border my-2" />
      {isAdmin && (
        <Button
          variant={activeTab === 'stats' ? 'default' : 'ghost'}
          className="w-full justify-start text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
          onClick={() => handleTabChange('stats')}
        >
          <BarChart3 className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Stats & Analytics
        </Button>
      )}
      <Button
        variant={activeTab === 'settings' ? 'default' : 'ghost'}
        className="w-full justify-start text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('settings')}
      >
        <Settings className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Settings
      </Button>
    </>
  ), [activeTab, hasUnread, handleTabChange, isAdmin])

  return (
    <div 
      id="club-page-container"
      className="min-h-screen bg-background grid-pattern"
      style={backgroundStyle}
    >
      <AppHeader user={user} showBackButton={false} clubId={club.id} clubs={clubs} />

      <main className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 max-w-full overflow-x-hidden">
        <div className="flex gap-4 sm:gap-6 lg:gap-8 items-start">
          <aside className="w-48 lg:w-52 flex-shrink-0 hidden md:block self-start">
            <div className="sticky top-24 will-change-transform">
              <nav className="space-y-2 bg-card/80 backdrop-blur-sm border border-border/50 p-3 rounded-2xl shadow-lg">
                {renderNavigationButtons()}
              </nav>
            </div>
          </aside>

          <div className="md:hidden fixed top-[4.5rem] left-1.5 sm:left-2 z-40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 bg-card/90 backdrop-blur-sm border border-border/50 shadow-lg hover:bg-card"
            >
              <Menu className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-[260px] sm:w-[280px] p-0 bg-card/95 backdrop-blur-sm">
              <SheetHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/50">
                <SheetTitle className="text-base sm:text-lg font-semibold">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="p-3 sm:p-4 space-y-1.5 sm:space-y-2 overflow-y-auto max-h-[calc(100vh-100px)]">
                {renderNavigationButtons()}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex-1 min-w-0 md:pl-0 pl-9 sm:pl-10 flex flex-col min-h-0">
            {activeTab === 'settings' && (
              <div className="mb-4 sm:mb-5 md:mb-6 p-4 sm:p-5 md:p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50">
                <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
                  <div>
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground break-words">{currentClubName}</h2>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewClubName(currentClubName)
                            setEditClubNameOpen(true)
                          }}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-muted flex-shrink-0"
                        >
                          <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      )}
                      <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold text-xs sm:text-sm">
                        Division {club.division}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {club.memberships.length} member{club.memberships.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'home' && (
              <HomePageTab
                clubId={club.id}
                club={club}
                isAdmin={isAdmin}
                user={user}
                initialEvents={initialData?.calendarEvents as Record<string, unknown>[] | undefined}
                initialAnnouncements={initialData?.announcements as Record<string, unknown>[] | undefined}
                initialTests={initialData?.tests as Record<string, unknown>[] | undefined}
              />
            )}

            {activeTab === 'stream' && (
              <StreamTab
                clubId={club.id}
                division={club.division}
                currentMembership={currentMembership}
                teams={club.teams}
                isAdmin={isAdmin}
                user={user}
                initialAnnouncements={initialData?.announcements}
              />
            )}

            {activeTab === 'people' && (
              <PeopleTab
                club={club}
                currentMembership={currentMembership}
                isAdmin={isAdmin}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarTab
                clubId={club.id}
                division={club.division}
                currentMembership={currentMembership}
                isAdmin={isAdmin}
                user={user}
                initialEvents={initialData?.calendarEvents as CalendarEvent[] | undefined}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceTab
                clubId={club.id}
                isAdmin={isAdmin}
                user={user}
                initialAttendances={initialData?.attendances}
              />
            )}

            {activeTab === 'finance' && (
              <FinanceTab
                clubId={club.id}
                isAdmin={isAdmin}
                currentMembershipId={currentMembership.id}
                currentMembershipTeamId={currentMembership.teamId}
                division={club.division}
                initialExpenses={initialData?.expenses as Expense[] | undefined}
                initialPurchaseRequests={initialData?.purchaseRequests as PurchaseRequest[] | undefined}
                initialBudgets={initialData?.eventBudgets as EventBudget[] | undefined}
                initialTeams={club.teams as Team[]}
              />
            )}

            {activeTab === 'tests' && (
              <TestsTab
                clubId={club.id}
                isAdmin={isAdmin}
                initialTests={initialData?.tests as Record<string, unknown>[] | undefined}
              />
            )}

            {activeTab === 'gallery' && (
              <GalleryTab
                clubId={club.id}
                user={user}
                isAdmin={isAdmin}
                initialMediaItems={initialData?.mediaItems as MediaItem[] | undefined}
                initialAlbums={initialData?.albums as Album[] | undefined}
              />
            )}

            {activeTab === 'paperwork' && (
              <PaperworkTab
                clubId={club.id}
                user={user}
                isAdmin={isAdmin}
                initialForms={initialData?.forms as PaperworkForm[] | undefined}
              />
            )}

            {activeTab === 'todos' && (
              <TodoTab
                clubId={club.id}
                currentMembershipId={currentMembership.id}
                user={user}
                isAdmin={isAdmin}
                initialTodos={initialData?.todos as Todo[] | undefined}
              />
            )}

            {activeTab === 'tools' && (
              <ToolsTab
                clubId={club.id}
                division={club.division}
                currentMembershipId={currentMembership.id}
                isAdmin={isAdmin}
              />
            )}

            {activeTab === 'stats' && isAdmin && (
              <StatsTab
                clubId={club.id}
                division={club.division}
                initialStats={initialData?.stats as StatsTabInitialStats | null | undefined}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                club={club}
                currentMembership={currentMembership}
                isAdmin={isAdmin}
                initialInviteCodes={initialInviteCodes}
                personalBackground={personalBackground as BackgroundPreferences | null | undefined}
                onBackgroundUpdate={handleBackgroundUpdate as ((preferences: BackgroundPreferences | null) => void) | undefined}
              />
            )}
          </div>
        </div>
      </main>

      <Dialog open={editClubNameOpen} onOpenChange={setEditClubNameOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateClubName}>
            <DialogHeader>
              <DialogTitle>Edit Club Name</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="club-name">Club Name</Label>
                <Input
                  id="club-name"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  placeholder="Enter club name"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditClubNameOpen(false)}
                disabled={updatingClubName}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updatingClubName || !newClubName.trim()}>
                {updatingClubName && (
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {updatingClubName ? 'Updating...' : 'Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Keep backward compatibility export
export { ClubPage as TeamPage }
