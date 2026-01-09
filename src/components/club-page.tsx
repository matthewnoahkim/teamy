'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Home, MessageSquare, Users, Calendar, Settings, ClipboardCheck, DollarSign, FileText, Pencil, Image, File, Menu, CheckSquare, BarChart3, BookOpen, Wrench } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { HomePageTab } from '@/components/tabs/homepage-tab'
import { PageLoading } from '@/components/ui/loading-spinner'
import dynamic from 'next/dynamic'

// Lazy load heavy tab components for better initial load performance
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

interface ClubPageProps {
  club: any
  currentMembership: any
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  initialData?: {
    attendances?: any[]
    expenses?: any[]
    purchaseRequests?: any[]
    eventBudgets?: any[]
    calendarEvents?: any[]
    tests?: any[]
    announcements?: any[]
    mediaItems?: any[]
    albums?: any[]
    forms?: any[]
    todos?: any[]
    stats?: any
  }
}

export function ClubPage({ club, currentMembership, user, initialData }: ClubPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'home')
  const [editClubNameOpen, setEditClubNameOpen] = useState(false)
  const [currentClubName, setCurrentClubName] = useState(club.name)
  const [newClubName, setNewClubName] = useState(club.name)
  const [updatingClubName, setUpdatingClubName] = useState(false)
  const [tabNotifications, setTabNotifications] = useState<Record<string, boolean>>({})
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [personalBackground, setPersonalBackground] = useState(currentMembership.preferences ?? null)
  const DEFAULT_BACKGROUND = {
    backgroundType: 'grid',
    backgroundColor: '#f8fafc',
    gradientStartColor: '#e0e7ff',
    gradientEndColor: '#fce7f3',
    backgroundImageUrl: null,
  }
  const isAdmin = currentMembership.role === 'ADMIN'

  useEffect(() => {
    setPersonalBackground(currentMembership.preferences ?? null)
  }, [currentMembership.preferences])

  // Update favicon badge with total unread count across all tabs
  useFaviconBadge(totalUnreadCount)

  // Get last cleared time for a tab from localStorage
  const getLastClearedTime = (tab: string): Date => {
    if (typeof window === 'undefined') return new Date(0)
    const key = `lastCleared_${club.id}_${tab}_${user.id}`
    const stored = localStorage.getItem(key)
    return stored ? new Date(stored) : new Date(0)
  }

  // Clear notification for a tab when it's opened
  const clearTabNotification = (tab: string) => {
    if (typeof window === 'undefined') return
    const key = `lastCleared_${club.id}_${tab}_${user.id}`
    localStorage.setItem(key, new Date().toISOString())
    setTabNotifications(prev => {
      const updated = { ...prev, [tab]: false }
      // Recalculate total count
      const totalCount = Object.values(updated).filter(Boolean).length
      setTotalUnreadCount(totalCount)
      return updated
    })
  }

  // Check for new content in each tab (from anyone, not just other users)
  // Optimized: Only check tabs that aren't active, batch API calls, and cache announcements/calendar data
  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    
    const checkForNewContent = async () => {
      if (!isMounted) return
      
      const notifications: Record<string, boolean> = {}
      const tabsToCheck = ['stream', 'calendar', 'attendance', 'finance', 'tests', 'people'].filter(tab => tab !== activeTab)
      
      // Batch fetch shared data once (announcements and calendar are used by multiple tabs)
      let announcementsData: any = null
      let calendarData: any = null
      
      if (tabsToCheck.includes('stream') || tabsToCheck.includes('calendar') || tabsToCheck.includes('attendance')) {
        try {
          const [announcementsResponse, calendarResponse] = await Promise.all([
            fetch(`/api/announcements?clubId=${club.id}`),
            fetch(`/api/calendar?clubId=${club.id}`)
          ])
          
          if (announcementsResponse.ok) {
            announcementsData = await announcementsResponse.json()
          }
          if (calendarResponse.ok) {
            calendarData = await calendarResponse.json()
          }
        } catch (error) {
          console.error('Failed to fetch shared data:', error)
        }
      }

      // Stream: Check for new announcements
      if (tabsToCheck.includes('stream') && announcementsData) {
        try {
          const lastCleared = getLastClearedTime('stream')
          const hasNewAnnouncement = announcementsData.announcements?.some((announcement: any) => {
            const isNew = new Date(announcement.createdAt) > lastCleared
            const isFromOtherUser = announcement.author?.user?.id !== user.id
            return isNew && isFromOtherUser
          })
          
          const hasNewCalendarPost = announcementsData.announcements?.some((announcement: any) => {
            const announcementCreated = new Date(announcement.createdAt)
            const isNew = announcementCreated > lastCleared
            const isFromOtherUser = announcement.author?.user?.id !== user.id
            return isNew && announcement.calendarEventId && isFromOtherUser
          })
          
          notifications.stream = !!(hasNewAnnouncement || hasNewCalendarPost)
        } catch (error) {
          console.error('Failed to check stream notifications:', error)
        }
      }

      // Calendar: Check for new events
      if (tabsToCheck.includes('calendar') && calendarData) {
        try {
          const lastCleared = getLastClearedTime('calendar')
          const events = calendarData.events || []
          const hasNewEvent = events.some((event: any) => {
            const isNew = new Date(event.createdAt) > lastCleared
            const isFromOtherUser = event.creator?.user?.id !== user.id
            return isNew && isFromOtherUser
          })
          
          const hasNewEventFromAnnouncement = announcementsData?.announcements?.some((announcement: any) => {
            const announcementCreated = new Date(announcement.createdAt)
            const isNew = announcementCreated > lastCleared
            const isFromOtherUser = announcement.author?.user?.id !== user.id
            return isNew && announcement.calendarEventId && isFromOtherUser
          })
          
          notifications.calendar = !!(hasNewEvent || hasNewEventFromAnnouncement)
        } catch (error) {
          console.error('Failed to check calendar notifications:', error)
        }
      }

      // Attendance: Check for new attendance records
      if (tabsToCheck.includes('attendance')) {
        try {
          const attendanceResponse = await fetch(`/api/attendance?clubId=${club.id}`)
          if (attendanceResponse.ok) {
            const attendanceData = await attendanceResponse.json()
            const lastCleared = getLastClearedTime('attendance')
            const hasNewAttendance = attendanceData.attendance?.some((record: any) => {
              const isNew = new Date(record.createdAt) > lastCleared
              const isFromOtherUser = record.createdById !== currentMembership.id
              return isNew && isFromOtherUser
            })
            
            const hasNewCalendarEvent = calendarData?.events?.some((event: any) => {
              const isNew = new Date(event.createdAt) > lastCleared
              const isFromOtherUser = event.creator?.user?.id !== user.id
              return isNew && isFromOtherUser
            })
            
            notifications.attendance = !!(hasNewAttendance || hasNewCalendarEvent)
          }
        } catch (error) {
          console.error('Failed to check attendance notifications:', error)
        }
      }

      // Finance: Check for new purchase requests or expenses
      if (tabsToCheck.includes('finance')) {
        try {
          const lastCleared = getLastClearedTime('finance')
          
          const [financeResponse, expensesResponse] = await Promise.all([
            fetch(`/api/purchase-requests?clubId=${club.id}`),
            fetch(`/api/expenses?clubId=${club.id}`)
          ])
          
          let hasNewRequest = false
          let hasNewExpense = false
          let hasNewApproval = false
          
          if (financeResponse.ok) {
            const financeData = await financeResponse.json()
            const purchaseRequests = financeData.purchaseRequests || []
            hasNewRequest = purchaseRequests.some((item: any) => {
              const isNew = new Date(item.createdAt) > lastCleared
              const isFromOtherUser = item.requesterId !== currentMembership.id
              return isNew && isFromOtherUser
            })
            
            hasNewApproval = purchaseRequests.some((request: any) => {
              if (request.status === 'APPROVED' && request.reviewedAt) {
                const isNew = new Date(request.reviewedAt) > lastCleared
                const isFromOtherUser = request.requesterId !== currentMembership.id
                return isNew && isFromOtherUser
              }
              return false
            })
          }
          
          if (expensesResponse.ok) {
            const expensesData = await expensesResponse.json()
            const expenses = expensesData.expenses || []
            hasNewExpense = expenses.some((item: any) => {
              const isNew = new Date(item.createdAt) > lastCleared
              const isFromOtherUser = item.addedById !== currentMembership.id
              return isNew && isFromOtherUser
            })
          }
          
          notifications.finance = !!(hasNewRequest || hasNewExpense || hasNewApproval)
        } catch (error) {
          console.error('Failed to check finance notifications:', error)
        }
      }

      // Tests: Check for new tests
      if (tabsToCheck.includes('tests')) {
        try {
          const testsResponse = await fetch(`/api/tests?clubId=${club.id}`)
          if (testsResponse.ok) {
            const testsData = await testsResponse.json()
            const lastCleared = getLastClearedTime('tests')
            const hasNew = testsData.tests?.some((test: any) => {
              const isNew = new Date(test.createdAt) > lastCleared
              const isFromOtherUser = test.createdById !== currentMembership.id
              return isNew && isFromOtherUser
            })
            notifications.tests = !!hasNew
          }
        } catch (error) {
          console.error('Failed to check tests notifications:', error)
        }
      }

      // People: Check for new members (no API call needed - uses existing club.memberships)
      if (tabsToCheck.includes('people')) {
        try {
          const lastCleared = getLastClearedTime('people')
          const hasNew = club.memberships?.some((membership: any) => {
            const isNew = new Date(membership.createdAt) > lastCleared
            return isNew
          })
          notifications.people = !!hasNew
        } catch (error) {
          console.error('Failed to check people notifications:', error)
        }
      }

      if (isMounted) {
        setTabNotifications(prev => {
          const updated = { ...prev, ...notifications }
          const totalCount = Object.values(updated).filter(Boolean).length
          setTotalUnreadCount(totalCount)
          return updated
        })
      }
    }

    // Debounce initial check slightly to avoid running on every activeTab change
    timeoutId = setTimeout(() => {
      checkForNewContent()
    }, 100)
    
    const interval = setInterval(checkForNewContent, 30000)
    
    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
      clearInterval(interval)
    }
  }, [club.id, club.memberships, user.id, currentMembership.id, activeTab])

  // Clear notification when tab is opened
  useEffect(() => {
    if (activeTab) {
      clearTabNotification(activeTab)
    }
  }, [activeTab, club.id, user.id])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const handleTabChange = (newTab: string) => {
    clearTabNotification(newTab)
    setActiveTab(newTab)
    setMobileMenuOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', newTab)
    router.replace(url.pathname + url.search, { scroll: false })
  }

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
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update club name',
        variant: 'destructive',
      })
    } finally {
      setUpdatingClubName(false)
    }
  }

  const handleBackgroundUpdate = (prefs: any | null) => {
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
  const showGridPattern = effectiveBgType === 'grid'

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
        {tabNotifications.stream && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </span>
        )}
      </Button>
      <Button
        variant={activeTab === 'people' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('people')}
      >
        <Users className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        People
        {tabNotifications.people && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </span>
        )}
      </Button>
      <Button
        variant={activeTab === 'calendar' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('calendar')}
      >
        <Calendar className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Calendar
        {tabNotifications.calendar && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </span>
        )}
      </Button>
      <Button
        variant={activeTab === 'attendance' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('attendance')}
      >
        <ClipboardCheck className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Attendance
        {tabNotifications.attendance && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </span>
        )}
      </Button>
      <Button
        variant={activeTab === 'finance' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('finance')}
      >
        <DollarSign className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Finance
        {tabNotifications.finance && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </span>
        )}
      </Button>
      <Button
        variant={activeTab === 'tests' ? 'default' : 'ghost'}
        className="w-full justify-start relative text-xs sm:text-sm font-semibold h-10 sm:h-11 rounded-2xl"
        onClick={() => handleTabChange('tests')}
      >
        <FileText className="mr-2 sm:mr-3 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Tests
        {tabNotifications.tests && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </span>
        )}
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
        {tabNotifications.todos && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </span>
        )}
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
  ), [activeTab, tabNotifications, handleTabChange, isAdmin])

  return (
    <div 
      id="club-page-container"
      className="min-h-screen bg-background grid-pattern"
      style={backgroundStyle}
    >
      <AppHeader user={user} showBackButton={true} backHref="/dashboard" title={currentClubName} />

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
                initialEvents={initialData?.calendarEvents}
                initialAnnouncements={initialData?.announcements}
                initialTests={initialData?.tests}
              />
            )}

            {activeTab === 'stream' && (
              <StreamTab
                clubId={club.id}
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
                currentMembership={currentMembership}
                isAdmin={isAdmin}
                user={user}
                initialEvents={initialData?.calendarEvents}
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
                initialExpenses={initialData?.expenses}
                initialPurchaseRequests={initialData?.purchaseRequests}
                initialBudgets={initialData?.eventBudgets}
                initialTeams={club.teams}
              />
            )}

            {activeTab === 'tests' && (
              <TestsTab
                clubId={club.id}
                isAdmin={isAdmin}
                initialTests={initialData?.tests}
              />
            )}

            {activeTab === 'gallery' && (
              <GalleryTab
                clubId={club.id}
                user={user}
                isAdmin={isAdmin}
                initialMediaItems={initialData?.mediaItems}
                initialAlbums={initialData?.albums}
              />
            )}

            {activeTab === 'paperwork' && (
              <PaperworkTab
                clubId={club.id}
                user={user}
                isAdmin={isAdmin}
                initialForms={initialData?.forms}
              />
            )}

            {activeTab === 'todos' && (
              <TodoTab
                clubId={club.id}
                currentMembershipId={currentMembership.id}
                user={user}
                isAdmin={isAdmin}
                initialTodos={initialData?.todos}
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
                initialStats={initialData?.stats}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                club={club}
                currentMembership={currentMembership}
                isAdmin={isAdmin}
                personalBackground={personalBackground}
                onBackgroundUpdate={handleBackgroundUpdate}
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

