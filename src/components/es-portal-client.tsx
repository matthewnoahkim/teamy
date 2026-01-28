'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import type { JSX } from 'react'
import { signOut } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { NoteSheetReview } from '@/components/tests/note-sheet-review'
import { 
  ClipboardList,
  LogOut, 
  Calendar,
  FileText,
  Plus,
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trophy,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ExternalLink,
  Search,
  Pencil,
  RefreshCw,
  Eye,
  Copy,
  Settings,
} from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import Link from 'next/link'
import { formatDivision } from '@/lib/utils'

interface Test {
  id: string
  name: string
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  eventId: string | null
  createdAt: string
  updatedAt: string
  allowNoteSheet?: boolean
  event?: {
    id: string
    name: string
  } | null
  staff?: {
    id: string
    name: string | null
    email: string
  }
  createdBy?: {
    id: string
    name: string | null
    email: string
  }
  questions: Array<{
    id: string
    type: string
    promptMd: string
    points: number
    order: number
    options: Array<{
      id: string
      label: string
      isCorrect: boolean
      order: number
    }>
  }>
}

interface StaffMembership {
  id: string
  email: string
  name: string | null
  role: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  invitedAt: string
  acceptedAt: string | null
  tournament: {
    id: string
    name: string
    division: 'B' | 'C' | 'B&C' | string
    startDate: string
    slug?: string | null
  }
  events: Array<{
    event: {
      id: string | null
      name: string
      division: 'B' | 'C'
    }
    tests: Test[]
  }>
}

interface TimelineItem {
  id: string
  name: string
  description: string | null
  dueDate: string
  type: string
}

interface ESPortalClientProps {
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  staffMemberships: StaffMembership[]
  initialTimelines?: Record<string, TimelineItem[]>
  initialTournamentId?: string | null
}

// Helper function to highlight search terms in text
const highlightText = (text: string | null | undefined, searchQuery: string): string | (string | JSX.Element)[] => {
  if (!text || !searchQuery) return text || ''
  
  const query = searchQuery.trim()
  if (!query) return text
  
  // Escape special regex characters
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = text.split(regex)
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-900 text-foreground px-0.5 rounded">
        {part}
      </mark>
    ) : part
  )
}

export function ESPortalClient({ user, staffMemberships, initialTimelines = {}, initialTournamentId }: ESPortalClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Use server-provided tournament ID or read from URL, return empty string if none
  const getInitialTab = () => {
    // Prefer server-provided value (avoids hydration mismatch)
    if (initialTournamentId && staffMemberships.some(m => m.tournament.id === initialTournamentId)) {
      return initialTournamentId
    }
    // Fallback to reading from URL (client-side)
    const tournamentIdFromUrl = searchParams.get('tournament')
    if (tournamentIdFromUrl && staffMemberships.some(m => m.tournament.id === tournamentIdFromUrl)) {
      return tournamentIdFromUrl
    }
    return ''
  }
  
  const [activeTournament, setActiveTournament] = useState<string>(getInitialTab)
  const [activeContentTab, setActiveContentTab] = useState<'events' | 'timeline'>('events')
  const [isHydrated, setIsHydrated] = useState(false)
  const [timelines, setTimelines] = useState<Record<string, TimelineItem[]>>(() => initialTimelines)
  const [loadingTimelines, setLoadingTimelines] = useState<Set<string>>(new Set())
  // Initialize with tests from server-side props (server-side fetch includes tests, so use them directly)
  const [staffMembershipsWithTests, setStaffMembershipsWithTests] = useState<StaffMembership[]>(() => {
    // Check if tests are already included in the props (from server-side fetch)
    const hasTestsInProps = staffMemberships.some(m => 
      m.events.some(e => 'tests' in e && Array.isArray((e as any).tests))
    )
    
    if (hasTestsInProps) {
      // Tests already loaded from server, use them
      return staffMemberships as StaffMembership[]
    }
    
    // No tests in props, initialize with empty arrays (client-side fetch will populate)
    return staffMemberships.map(membership => ({
      ...membership,
      events: membership.events.map(e => ({
        ...e,
        tests: [],
      })),
    }))
  })
  const [loadingTests, setLoadingTests] = useState(false)
  const hasInitialized = useRef(false)
  const hasFetchedTests = useRef(false)
  const lastFetchTime = useRef<number>(0)
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActiveTournamentRef = useRef<string>('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [testToDelete, setTestToDelete] = useState<Test | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user.name ?? null)
  const [noteSheetReviewOpen, setNoteSheetReviewOpen] = useState<string | null>(null)
  const { toast } = useToast()

  // Load saved content tab from localStorage on mount and mark as hydrated
  useEffect(() => {
    try {
      if (activeTournament) {
        const storageKey = `es-portal-tab-${activeTournament}`
        const savedTab = localStorage.getItem(storageKey) as 'events' | 'timeline' | null
        if (savedTab && (savedTab === 'events' || savedTab === 'timeline')) {
          setActiveContentTab(savedTab)
        }
      }
    } catch (e) {
      // localStorage not available
    }
    setIsHydrated(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save content tab to localStorage when it changes
  useEffect(() => {
    if (isHydrated && activeTournament) {
      try {
        const storageKey = `es-portal-tab-${activeTournament}`
        localStorage.setItem(storageKey, activeContentTab)
      } catch (e) {
        // localStorage not available
      }
    }
  }, [activeContentTab, activeTournament, isHydrated])

  // Handle content tab changes
  const handleContentTabChange = (value: string) => {
    setActiveContentTab(value as 'events' | 'timeline')
  }
  
  const formatType = (type: string) =>
    type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())

  const handleSignOut = () => {
    signOut({ callbackUrl: '/es' })
  }

  const handleDeleteClick = (test: Test) => {
    setTestToDelete(test)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!testToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/es/tests?testId=${testToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete test')
      }

      toast({
        title: 'Test Deleted',
        description: 'The test has been successfully deleted.',
      })

      setDeleteDialogOpen(false)
      setTestToDelete(null)
      
      // Refresh tests list (force fetch after delete)
      fetchTests(true)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete test',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicateTest = async (testId: string) => {
    try {
      const response = await fetch(`/api/es/tests/${testId}/duplicate`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to duplicate test')
      }

      toast({
        title: 'Test Duplicated',
        description: 'The test has been duplicated as a draft.',
      })

      // Refresh tests list
      fetchTests(true)
    } catch (error: any) {
      console.error('Failed to duplicate test:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate test',
        variant: 'destructive',
      })
    }
  }

  // Fetch timeline for a tournament
  const fetchTimeline = async (tournamentId: string) => {
    if (loadingTimelines.has(tournamentId) || timelines[tournamentId]) return
    
    setLoadingTimelines(prev => new Set([...prev, tournamentId]))
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/timeline`)
      if (res.ok) {
        const data = await res.json()
        setTimelines(prev => ({ ...prev, [tournamentId]: data.timeline }))
      }
    } catch (error) {
      console.error('Failed to fetch timeline:', error)
    } finally {
      setLoadingTimelines(prev => {
        const next = new Set(prev)
        next.delete(tournamentId)
        return next
      })
    }
  }

  // Fetch tests organized by event
  // Only fetch if enough time has passed since last fetch (debounce)
  const fetchTests = async (force = false) => {
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchTime.current
    const MIN_FETCH_INTERVAL = 2000 // Minimum 2 seconds between fetches
    
    // Prevent too-frequent fetches unless forced
    if (!force && timeSinceLastFetch < MIN_FETCH_INTERVAL) {
      // Schedule a fetch after the minimum interval
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
      fetchTimeoutRef.current = setTimeout(() => {
        fetchTests(true)
      }, MIN_FETCH_INTERVAL - timeSinceLastFetch)
      return
    }
    
    if (loadingTests) return
    
    lastFetchTime.current = now
    setLoadingTests(true)
    try {
      // Use includeQuestions=false to reduce payload size (we already have questions from server)
      const url = force 
        ? `/api/es/tests?includeQuestions=false&t=${Date.now()}` 
        : '/api/es/tests?includeQuestions=false'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setStaffMembershipsWithTests(data.staffMemberships)
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to fetch tests:', errorData)
      }
    } catch (error) {
      console.error('Failed to fetch tests:', error)
    } finally {
      setLoadingTests(false)
    }
  }

  // Helper to check if we have tests data for the active tournament
  const hasTestsForActiveTournament = () => {
    if (!activeTournament) return false
    const membership = staffMembershipsWithTests.find(m => m.tournament.id === activeTournament)
    if (!membership) return false
    // Check if we have any events with tests data loaded
    return membership.events.some(e => Array.isArray(e.tests))
  }

  // Fetch tests when tournament is selected and we don't have data yet
  // Similar to TD portal: only fetch when tab is active and data is empty
  useEffect(() => {
    // Only fetch if:
    // 1. We have an active tournament
    // 2. Tournament actually changed (not just initial render)
    // 3. We don't already have tests data for this tournament
    if (activeTournament && activeTournament !== lastActiveTournamentRef.current) {
      lastActiveTournamentRef.current = activeTournament
      
      // Check if we already have data for this tournament
      if (!hasTestsForActiveTournament()) {
        fetchTests(true) // Force fetch when switching to a tournament without data
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournament])
  
  // Initial fetch on mount only if we don't have server-side data
  useEffect(() => {
    // Check if tests are already in the initial state (from server-side)
    const hasServerSideTests = staffMembershipsWithTests.some(m => 
      m.events.some(e => Array.isArray(e.tests) && e.tests.length > 0)
    )
    
    // Only fetch if we don't already have tests from server-side
    if (!hasServerSideTests && activeTournament) {
      // Only fetch if we have an active tournament and no data
      if (!hasTestsForActiveTournament()) {
        fetchTests(true) // Force initial fetch
      }
    }
    hasFetchedTests.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run once on mount

  // Ensure URL is set correctly on mount
  useEffect(() => {
    if (hasInitialized.current) return
    
    hasInitialized.current = true
    const tournamentIdFromUrl = searchParams.get('tournament')
    
    // If URL has a tournament param, set activeTournament to it
    if (tournamentIdFromUrl && staffMemberships.some(m => m.tournament.id === tournamentIdFromUrl)) {
      setActiveTournament(tournamentIdFromUrl)
    } else if (!tournamentIdFromUrl) {
      // No tournament in URL, clear activeTournament
      setActiveTournament('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Sync with URL changes after initialization (e.g., browser back/forward)
  useEffect(() => {
    if (!hasInitialized.current) return
    
    const tournamentIdFromUrl = searchParams.get('tournament')
    
    if (tournamentIdFromUrl && tournamentIdFromUrl !== activeTournament && staffMemberships.some(m => m.tournament.id === tournamentIdFromUrl)) {
      setActiveTournament(tournamentIdFromUrl)
    } else if (!tournamentIdFromUrl && activeTournament) {
      // URL param was removed, clear activeTournament
      setActiveTournament('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  
  useEffect(() => {
    // Clean up any pending fetch timeout on unmount
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, [])
  
  useEffect(() => {
    if (activeTournament) {
      fetchTimeline(activeTournament)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTournament])

  const getTimelineStatus = (dueDate: string) => {
    const date = new Date(dueDate)
    if (isPast(date) && !isToday(date)) return 'overdue'
    if (isToday(date)) return 'today'
    return 'upcoming'
  }

  return (
    <div className="min-h-screen bg-background grid-pattern flex flex-col">
      {/* Header */}
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" href="/" variant="light" />
            <div className="h-6 w-px bg-white/20" />
            <span className="text-white font-semibold">Event Supervisor Portal</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 sm:gap-3 outline-none">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer ring-2 ring-white/30 hover:ring-white/50 transition-all">
                    <AvatarImage src={user.image || ''} />
                    <AvatarFallback className="bg-white/20 text-white font-semibold text-sm">
                      {currentUserName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left max-w-[120px] md:max-w-none">
                    <p className="text-xs sm:text-sm font-medium text-white truncate">
                      {currentUserName || user.email}
                    </p>
                    <p className="text-[10px] sm:text-xs text-white/60 truncate">{user.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/60 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setEditUsernameOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Username
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-default">
                  <ThemeToggle variant="menu" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome, {user.name?.split(' ')[0] || 'Event Supervisor'}!
          </h1>
          <p className="text-muted-foreground">
            Manage your tournament assignments and create tests for your events.
          </p>
        </div>

        {/* Show detail view if tournament is selected, otherwise show tournament cards */}
        {activeTournament && staffMemberships.some(m => m.tournament.id === activeTournament) ? (
          <div className="space-y-6">
            <Button
              variant="ghost"
              onClick={() => {
                setActiveTournament('')
                router.push('/es', { scroll: false })
              }}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tournaments
            </Button>
            
            {(() => {
              const membership = staffMembershipsWithTests.find(m => m.tournament.id === activeTournament) || staffMemberships.find(m => m.tournament.id === activeTournament)!
              return (
                <>
                  {/* Tournament Info */}
                  <Card className="bg-card/90 backdrop-blur border border-white/10">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-xl">{membership.tournament.name}</CardTitle>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(membership.tournament.startDate), 'MMM d, yyyy')}
                            </span>
                            <Badge variant="outline">Division {formatDivision(membership.tournament.division)}</Badge>
                          </div>
                        </div>
                        {membership.tournament.slug && (
                          <Link href={`/tournaments/${membership.tournament.slug}`} target="_blank">
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Public Page
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Tabs */}
                  {isHydrated && (
                    <Tabs value={activeContentTab} onValueChange={handleContentTabChange} className="space-y-6">
                      <TabsList className="grid grid-cols-2 w-full max-w-lg">
                        <TabsTrigger value="events" className="gap-2">
                          <ClipboardList className="h-4 w-4" />
                          Events
                        </TabsTrigger>
                        <TabsTrigger value="timeline" className="gap-2">
                          <Calendar className="h-4 w-4" />
                          Timeline
                        </TabsTrigger>
                      </TabsList>

                      {/* Events Tab */}
                      <TabsContent value="events" className="space-y-6">
                        <Card className="bg-card/90 backdrop-blur border border-white/10">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <ClipboardList className="h-5 w-5 text-teamy-primary" />
                              Your Events
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {loadingTests ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                                <p>Loading events and tests...</p>
                              </div>
                            ) : membership.events.length === 0 ? (
                              <div className="text-center py-8">
                                <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                <p className="text-muted-foreground">No events assigned yet.</p>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {/* Search and Filter Controls */}
                                <div className="flex flex-col sm:flex-row gap-3 pb-4 border-b border-border">
                                  <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      placeholder="Search tests..."
                                      value={searchQuery}
                                      onChange={(e) => setSearchQuery(e.target.value)}
                                      className="pl-9"
                                    />
                                  </div>
                                  <Select value={eventFilter} onValueChange={setEventFilter}>
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                      <SelectValue placeholder="Filter by event" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All Events</SelectItem>
                                      {[...membership.events]
                                        .sort((a, b) => a.event.name.localeCompare(b.event.name))
                                        .map((eventAssignment) => {
                                          const isTrialEvent = eventAssignment.event.id === null
                                          const eventKey = eventAssignment.event.id || `trial-${eventAssignment.event.name}`
                                          const showDivision = membership.tournament.division === 'B&C'
                                          return (
                                            <SelectItem key={eventKey} value={eventKey}>
                                              {eventAssignment.event.name} {isTrialEvent && '(Trial)'} {showDivision && `(Div ${eventAssignment.event.division})`}
                                            </SelectItem>
                                          )
                                        })}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Events and Tests */}
                                {[...membership.events]
                                  .sort((a, b) => a.event.name.localeCompare(b.event.name))
                                  .filter((eventAssignment) => {
                                    // Filter by selected event (handle trial events)
                                    if (eventFilter !== 'all') {
                                      const eventKey = eventAssignment.event.id || `trial-${eventAssignment.event.name}`
                                      if (eventKey !== eventFilter) {
                                        return false
                                      }
                                    }
                                    // Show event if it has tests matching search query or no search query
                                    if (!searchQuery) return true
                                    const tests = eventAssignment.tests || []
                                    return tests.some((test) =>
                                      test.name.toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                  })
                                  .map((eventAssignment) => {
                                    const allTests = eventAssignment.tests || []
                                    // Filter tests by search query
                                    const filteredTests = allTests.filter((test) => {
                                      if (!searchQuery) return true
                                      return test.name.toLowerCase().includes(searchQuery.toLowerCase())
                                    })
                                    
                                    // Skip event if showing all events and no tests match search
                                    if (filteredTests.length === 0 && eventFilter === 'all' && searchQuery) {
                                      return null
                                    }
                                    
                                    const isTrialEvent = eventAssignment.event.id === null
                                    const eventKey = eventAssignment.event.id || `trial-${eventAssignment.event.name}`
                                    
                                    return (
                                      <div key={eventKey} className="space-y-3">
                                        <div className="flex items-center justify-between pb-2 border-b border-border">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <h3 className="font-semibold text-lg">{eventAssignment.event.name}</h3>
                                              {isTrialEvent && (
                                                <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400">
                                                  Trial
                                                </Badge>
                                              )}
                                              {membership.tournament.division === 'B&C' && (
                                                <Badge variant="outline" className="text-xs">
                                                  Div {eventAssignment.event.division}
                                                </Badge>
                                              )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                              {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''}
                                              {searchQuery && filteredTests.length !== allTests.length && (
                                                <span> (filtered from {allTests.length})</span>
                                              )}
                                            </p>
                                          </div>
                                          <Link 
                                            href={
                                              isTrialEvent
                                                ? `/es/tests/new?staffId=${membership.id}&eventName=${encodeURIComponent(eventAssignment.event.name)}&trialEventDivision=${eventAssignment.event.division}`
                                                : `/es/tests/new?staffId=${membership.id}&eventId=${eventAssignment.event.id}`
                                            }
                                          >
                                            <Button size="sm" className="bg-teamy-primary text-white hover:bg-teamy-primary-dark">
                                              <Plus className="h-4 w-4 mr-2" />
                                              Create Test
                                            </Button>
                                          </Link>
                                        </div>
                                        
                                        {filteredTests.length === 0 ? (
                                          <div className="text-center py-6 bg-muted/50 rounded-lg border border-border">
                                            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                                            <p className="text-sm text-muted-foreground">
                                              {searchQuery 
                                                ? `No tests match "${searchQuery}" for this event.`
                                                : 'No tests created yet for this event.'}
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="space-y-3">
                                            {filteredTests.map((test) => (
                                              <div 
                                                key={test.id}
                                                className="flex items-center justify-between p-4 rounded-lg border bg-card"
                                              >
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-semibold">
                                                      {searchQuery ? highlightText(test.name, searchQuery) : test.name}
                                                    </h4>
                                                    <Badge 
                                                      variant="outline" 
                                                      className={
                                                        test.status === 'PUBLISHED' 
                                                          ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                                                          : test.status === 'CLOSED'
                                                            ? 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                                                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                      }
                                                    >
                                                      {test.status}
                                                    </Badge>
                                                  </div>
                                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                    <span>{test.questions.length} question{test.questions.length !== 1 ? 's' : ''}</span>
                                                    {test.createdBy && (
                                                      <>
                                                        <span>•</span>
                                                        <span>Created by {test.createdBy.name || test.createdBy.email}</span>
                                                      </>
                                                    )}
                                                    {test.updatedAt !== test.createdAt && (
                                                      <>
                                                        <span>•</span>
                                                        <span>
                                                          Last edited {
                                                            test.staff && test.createdBy && test.staff.id !== test.createdBy.id 
                                                              ? `by ${test.staff.name || test.staff.email} `
                                                              : test.staff
                                                                ? `by ${test.staff.name || test.staff.email} `
                                                                : test.createdBy 
                                                                  ? `by ${test.createdBy.name || test.createdBy.email} `
                                                                  : ''
                                                          }
                                                          on {format(new Date(test.updatedAt), 'MMM d, yyyy \'at\' h:mm a')}
                                                        </span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                                <TooltipProvider>
                                                  <div className="flex gap-2">
                                                    {test.status !== 'PUBLISHED' && (
                                                      <Link href={`/es/tests/${test.id}`}>
                                                        <Button variant="outline" size="sm">
                                                          <Edit className="h-4 w-4 mr-1" />
                                                          Edit
                                                        </Button>
                                                      </Link>
                                                    )}
                                                    {test.status === 'PUBLISHED' && (
                                                      <Link href={`/es/tests/${test.id}/responses`}>
                                                        <Button variant="outline" size="sm">
                                                          <Eye className="h-4 w-4 mr-1" />
                                                          Responses
                                                        </Button>
                                                      </Link>
                                                    )}
                                                    {test.allowNoteSheet && (
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            onClick={() => setNoteSheetReviewOpen(test.id)}
                                                          >
                                                            <FileText className="h-4 w-4" />
                                                          </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                          <p>Note Sheets</p>
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    )}
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <Button 
                                                          variant="outline" 
                                                          size="sm"
                                                          onClick={() => handleDuplicateTest(test.id)}
                                                        >
                                                          <Copy className="h-4 w-4" />
                                                        </Button>
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p>Duplicate</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                    {test.status === 'PUBLISHED' && (
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <Link href={`/es/tests/${test.id}/settings`}>
                                                            <Button variant="outline" size="sm">
                                                              <Settings className="h-4 w-4" />
                                                            </Button>
                                                          </Link>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                          <p>Settings</p>
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    )}
                                                    <Tooltip>
                                                      <TooltipTrigger asChild>
                                                        <Button 
                                                          variant="outline" 
                                                          size="sm"
                                                          onClick={() => handleDeleteClick(test)}
                                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                      </TooltipTrigger>
                                                      <TooltipContent>
                                                        <p>Delete</p>
                                                      </TooltipContent>
                                                    </Tooltip>
                                                  </div>
                                                </TooltipProvider>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })
                                  .filter(Boolean)}
                                
                                {/* Show message if no events match filters */}
                                {[...membership.events]
                                  .filter((eventAssignment) => {
                                    if (eventFilter !== 'all') {
                                      const eventKey = eventAssignment.event.id || `trial-${eventAssignment.event.name}`
                                      if (eventKey !== eventFilter) {
                                        return false
                                      }
                                    }
                                    if (!searchQuery) return true
                                    const tests = eventAssignment.tests || []
                                    return tests.some((test) =>
                                      test.name.toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                  }).length === 0 && (
                                  <div className="text-center py-12">
                                    <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <p className="text-muted-foreground">
                                      No tests found matching your search criteria.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      {/* Timeline Tab */}
                      <TabsContent value="timeline" className="space-y-6">
                        {timelines[membership.tournament.id] && timelines[membership.tournament.id].length > 0 ? (
                          <Card className="bg-card/90 backdrop-blur border border-white/10">
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-teamy-primary" />
                                Timeline & Deadlines
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {timelines[membership.tournament.id].map(item => {
                                  const status = getTimelineStatus(item.dueDate)
                                  return (
                                    <div 
                                      key={item.id}
                                      className={`flex items-center justify-between p-3 rounded-lg border ${
                                        status === 'overdue' 
                                          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30' 
                                          : status === 'today'
                                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30'
                                            : 'bg-muted border-border'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        {status === 'overdue' ? (
                                          <AlertCircle className="h-5 w-5 text-red-500" />
                                        ) : status === 'today' ? (
                                          <Clock className="h-5 w-5 text-amber-500" />
                                        ) : (
                                          <CheckCircle2 className="h-5 w-5 text-teamy-primary" />
                                        )}
                                        <div>
                                          <p className="font-medium">{item.name}</p>
                                          {item.description && (
                                            <p className="text-sm text-muted-foreground">{item.description}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className={`text-sm font-medium ${
                                          status === 'overdue' ? 'text-red-600' : status === 'today' ? 'text-amber-600' : ''
                                        }`}>
                                          {format(new Date(item.dueDate), 'MMM d, yyyy')}
                                        </p>
                                        <Badge variant="outline" className="text-xs">
                                          {formatType(item.type)}
                                        </Badge>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card className="bg-card/90 backdrop-blur border border-white/10">
                            <CardContent className="py-12 text-center">
                              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                              <h3 className="text-lg font-semibold mb-2">No Timeline Items</h3>
                              <p className="text-muted-foreground">
                                There are no timeline items or deadlines for this tournament yet.
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </>
              )
            })()}
          </div>
        ) : (
          /* Tournaments */
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Your Tournaments</h2>
            
            {staffMemberships.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No Active Assignments</h3>
                  <p className="text-muted-foreground">
                    You don&apos;t have any tournament assignments yet. Contact a Tournament Director to get invited.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {staffMemberships.map((membership) => (
                  <Link
                    key={membership.tournament.id}
                    href={`/es?tournament=${membership.tournament.id}`}
                    className="block"
                  >
                    <Card className="overflow-hidden transition-all h-full cursor-pointer hover:shadow-lg hover:border-primary/30">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1 min-w-0">
                            <CardTitle className="text-lg truncate">{membership.tournament.name}</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(membership.tournament.startDate), 'MMM d, yyyy')}
                            </CardDescription>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge variant="outline">Division {formatDivision(membership.tournament.division)}</Badge>
                          {membership.events.length > 0 && (
                            <Badge variant="outline">
                              {membership.events.length} Event{membership.events.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        {membership.events.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Assigned Events: </span>
                            <span className="truncate">
                              {[...membership.events].sort((a, b) => a.event.name.localeCompare(b.event.name)).slice(0, 3).map(e => e.event.name).join(', ')}
                              {membership.events.length > 3 && ` +${membership.events.length - 3} more`}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4 mt-auto">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
              <p className="text-xs text-muted-foreground font-medium">FERPA and COPPA compliant</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{testToDelete?.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setTestToDelete(null)
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditUsernameDialog
        open={editUsernameOpen}
        onOpenChange={setEditUsernameOpen}
        currentName={currentUserName}
        onNameUpdated={setCurrentUserName}
      />

      {/* Note Sheet Review Dialog */}
      {noteSheetReviewOpen && (
        <NoteSheetReview
          open={!!noteSheetReviewOpen}
          onOpenChange={(open) => {
            if (!open) {
              setNoteSheetReviewOpen(null)
            }
          }}
          testId={noteSheetReviewOpen}
          testName={
            staffMembershipsWithTests
              .flatMap(m => m.events.flatMap(e => e.tests || []))
              .find(t => t.id === noteSheetReviewOpen)?.name || 'Test'}
        />
      )}
    </div>
  )
}
