'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { JSX } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import { 
  LogOut, 
  Clock, 
  MapPin, 
  Link as LinkIcon,
  Plus,
  Users,
  Calendar,
  Send,
  Trash2,
  UserPlus,
  ArrowLeft,
  Settings,
  ExternalLink,
  Edit,
  Trophy,
  Mail,
  ClipboardList,
  FileText,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Globe,
  Lock,
  Loader2,
  History,
  User,
  Eye,
  Unlock,
  Copy,
  Save,
  Pencil,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatDivision } from '@/lib/utils'
import { NoteSheetReview } from '@/components/tests/note-sheet-review'

interface StaffMember {
  id: string
  email: string
  name: string | null
  role: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  invitedAt: string
  acceptedAt: string | null
  user?: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
  events: Array<{
    event: {
      id: string
      name: string
      division: string
    }
  }>
  trialEvents?: string | null
  tests: Array<{
    id: string
    name: string
    status: string
    eventId: string | null
  }>
}

interface TimelineItem {
  id: string
  name: string
  description: string | null
  dueDate: string
  type: string
}

interface EventInfo {
  id: string
  name: string
  division: string
}

interface OtherDiscount {
  condition: string
  amount: number
}

interface Registration {
  id: string
  status: string
  paid: boolean
  createdAt: string
  club: {
    id: string
    name: string
    division: string
    memberships: Array<{
      user: {
        id: string
        name: string | null
        email: string
        image: string | null
      }
    }>
  }
  team: {
    id: string
    name: string
    members?: Array<{
      id: string
      user: {
        id: string
        name: string | null
        email: string
        image: string | null
      }
    }>
  } | null
  registeredBy: {
    id: string
    name: string | null
    email: string
  }
}

interface Tournament {
  id: string
  name: string
  slug: string | null
  division: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  location: string | null
  description: string | null
  isOnline: boolean
  price: number | null
  additionalTeamPrice: number | null
  feeStructure: string
  registrationStartDate: string | null
  registrationEndDate: string | null
  earlyBirdDiscount: number | null
  earlyBirdDeadline: string | null
  lateFee: number | null
  lateFeeStartDate: string | null
  otherDiscounts: string | null
  eligibilityRequirements: string | null
  eventsRun: string | null
  trialEvents: string | null
  published: boolean
  // From hosting request
  level: string | null
}

interface TDTournamentManageClientProps {
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  tournament: Tournament
  initialStaff: StaffMember[]
  initialTimeline: TimelineItem[]
  events: EventInfo[]
  initialRegistrations?: Registration[]
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

export function TDTournamentManageClient({ 
  user, 
  tournament, 
  initialStaff, 
  initialTimeline, 
  events,
  initialRegistrations = []
}: TDTournamentManageClientProps) {
  // Helper to check if tournament has ended
  const isTournamentEnded = () => {
    if (!tournament.endDate || !tournament.endTime) {
      return false // Can't determine if ended without dates
    }
    
    const endDate = new Date(tournament.endDate)
    const endTime = new Date(tournament.endTime)
    const tournamentEndDateTime = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      endTime.getHours(),
      endTime.getMinutes(),
      endTime.getSeconds()
    )
    
    return new Date() >= tournamentEndDateTime
  }
  
  const tournamentEnded = isTournamentEnded()
  const router = useRouter()
  const { toast } = useToast()
  
  // Persist active tab in localStorage
  const storageKey = `td-tournament-tab-${tournament.id}`
  const [activeTab, setActiveTab] = useState<'staff' | 'timeline' | 'settings' | 'events' | 'teams'>('staff')
  const [isHydrated, setIsHydrated] = useState(false)
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user.name ?? null)
  
  // Load saved tab from localStorage on mount and mark as hydrated
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem(storageKey) as 'staff' | 'timeline' | 'settings' | 'events' | 'teams' | null
      if (savedTab && ['staff', 'timeline', 'settings', 'events', 'teams'].includes(savedTab)) {
        setActiveTab(savedTab)
      }
    } catch (e) {
      // localStorage not available
    }
    setIsHydrated(true)
  }, [storageKey])
  
  // Save tab to localStorage when it changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(storageKey, activeTab)
      } catch (e) {
        // localStorage not available
      }
    }
  }, [activeTab, storageKey, isHydrated])
  
  // Handle tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value as 'staff' | 'timeline' | 'settings' | 'events' | 'teams')
  }
  
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff)
  const [registrations, setRegistrations] = useState<Registration[]>(initialRegistrations)
  const [loadingRegistrations, setLoadingRegistrations] = useState(false)
  const [isPublished, setIsPublished] = useState(tournament.published)
  const [publishing, setPublishing] = useState(false)
  const [expandedRegistrations, setExpandedRegistrations] = useState<Set<string>>(new Set())
  const [teamsSearchQuery, setTeamsSearchQuery] = useState('')
  const [timeline, setTimeline] = useState<TimelineItem[]>(initialTimeline)
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [loadingTimeline, setLoadingTimeline] = useState(false)
  const [editingTimelineItem, setEditingTimelineItem] = useState<TimelineItem | null>(null)
  
  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'EVENT_SUPERVISOR' as 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR',
    eventIds: [] as string[],
    trialEventNames: [] as string[],
  })
  const [inviting, setInviting] = useState(false)

  // Staff edit dialog state
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [editStaffForm, setEditStaffForm] = useState({
    role: 'EVENT_SUPERVISOR' as 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR',
    eventIds: [] as string[],
    trialEventNames: [] as string[],
  })
  const [updatingStaff, setUpdatingStaff] = useState(false)
  
  // Timeline dialog state
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false)
  const [timelineForm, setTimelineForm] = useState({
    name: '',
    description: '',
    dueDate: '',
    type: 'draft_due',
  })
  const [savingTimeline, setSavingTimeline] = useState(false)

  // Settings edit state
  const [isEditingSettings, setIsEditingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsFormErrors, setSettingsFormErrors] = useState<{
    startDate?: string
    endDate?: string
    startTime?: string
    endTime?: string
    registrationStartDate?: string
    registrationEndDate?: string
    earlyBirdDeadline?: string
    lateFeeStartDate?: string
  }>({})

  // Default test settings state
  const [defaultTestSettings, setDefaultTestSettings] = useState<any>(null)
  const [loadingDefaultTestSettings, setLoadingDefaultTestSettings] = useState(true)
  const [isEditingDefaultTestSettings, setIsEditingDefaultTestSettings] = useState(false)
  const [savingDefaultTestSettings, setSavingDefaultTestSettings] = useState(false)
  const [defaultTestSettingsForm, setDefaultTestSettingsForm] = useState({
    defaultDurationMinutes: '',
    defaultStartAt: '',
    defaultEndAt: '',
    defaultReleaseScoresAt: '',
    defaultScoreReleaseMode: 'FULL_TEST' as 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST' | '',
    defaultRequireFullscreen: true,
    defaultAllowCalculator: false,
    defaultCalculatorType: 'FOUR_FUNCTION' as 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING' | '',
    defaultAllowNoteSheet: false,
    defaultAutoApproveNoteSheet: true,
    defaultRequireOneSitting: true,
    defaultMaxAttempts: '',
  })
  const [settingsForm, setSettingsForm] = useState({
    // Extract dates from time fields to ensure consistency
    startDate: tournament.startTime 
      ? (() => {
          const dt = new Date(tournament.startTime)
          // Get date in local timezone to match what user sees
          const year = dt.getFullYear()
          const month = String(dt.getMonth() + 1).padStart(2, '0')
          const day = String(dt.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        })()
      : tournament.startDate?.split('T')[0] || '',
    endDate: tournament.endTime 
      ? (() => {
          const dt = new Date(tournament.endTime)
          // Get date in local timezone to match what user sees
          const year = dt.getFullYear()
          const month = String(dt.getMonth() + 1).padStart(2, '0')
          const day = String(dt.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        })()
      : tournament.endDate?.split('T')[0] || '',
    startTime: tournament.startTime?.slice(11, 16) || '',
    endTime: tournament.endTime?.slice(11, 16) || '',
    price: tournament.price?.toString() || '0',
    additionalTeamPrice: tournament.additionalTeamPrice?.toString() || '',
    feeStructure: tournament.feeStructure || 'flat',
    registrationStartDate: tournament.registrationStartDate ? tournament.registrationStartDate.split('T')[0] : undefined,
    registrationEndDate: tournament.registrationEndDate ? tournament.registrationEndDate.split('T')[0] : undefined,
    earlyBirdDiscount: tournament.earlyBirdDiscount?.toString() || '',
    earlyBirdDeadline: tournament.earlyBirdDeadline ? tournament.earlyBirdDeadline.split('T')[0] : undefined,
    lateFee: tournament.lateFee?.toString() || '',
    lateFeeStartDate: tournament.lateFeeStartDate ? tournament.lateFeeStartDate.split('T')[0] : undefined,
    otherDiscounts: tournament.otherDiscounts ? JSON.parse(tournament.otherDiscounts) as OtherDiscount[] : [],
    eligibilityRequirements: tournament.eligibilityRequirements || '',
    eventsRun: tournament.eventsRun ? JSON.parse(tournament.eventsRun) as string[] : [],
    trialEvents: tournament.trialEvents ? (() => {
      const parsed = JSON.parse(tournament.trialEvents)
      // Determine default division for backward compatibility
      const defaultDivision = tournament.division === 'C' ? 'C' : tournament.division === 'B' ? 'B' : 'C'
      // Handle backward compatibility: convert string[] to { name, division }[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          return parsed.map((name: string) => ({ name, division: defaultDivision }))
        }
        return parsed as Array<{ name: string; division: string }>
      }
      return [] as Array<{ name: string; division: string }>
    })() : [],
  })
  // Determine default division for new trial events based on tournament division
  const defaultTrialEventDivision = tournament.division === 'C' ? 'C' : tournament.division === 'B' ? 'B' : 'C'
  const [newTrialEvent, setNewTrialEvent] = useState({ name: '', division: defaultTrialEventDivision })
  const [newDiscount, setNewDiscount] = useState({ condition: '', amount: '' })
  const [hoveredTestBadge, setHoveredTestBadge] = useState<string | null>(null)

  // Events management dialog state
  const [eventsDialogOpen, setEventsDialogOpen] = useState(false)
  const [eventsDialogForm, setEventsDialogForm] = useState({
    eventsRun: tournament.eventsRun ? JSON.parse(tournament.eventsRun) as string[] : [],
    trialEvents: tournament.trialEvents ? (() => {
      const parsed = JSON.parse(tournament.trialEvents)
      const defaultDivision = tournament.division === 'C' ? 'C' : tournament.division === 'B' ? 'B' : 'C'
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          return parsed.map((name: string) => ({ name, division: defaultDivision }))
        }
        return parsed as Array<{ name: string; division: string }>
      }
      return [] as Array<{ name: string; division: string }>
    })() : [],
  })
  const [newTrialEventDialog, setNewTrialEventDialog] = useState({ name: '', division: defaultTrialEventDivision })
  const [savingEventsDialog, setSavingEventsDialog] = useState(false)

  // Helper function to parse trial events
  const parseTrialEvents = (trialEventsStr: string | null) => {
    if (!trialEventsStr) return []
    try {
      const parsed = JSON.parse(trialEventsStr)
      const defaultDivision = tournament.division === 'C' ? 'C' : tournament.division === 'B' ? 'B' : 'C'
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          return parsed.map((name: string) => ({ name, division: defaultDivision }))
        }
        return parsed as Array<{ name: string; division: string }>
      }
      return [] as Array<{ name: string; division: string }>
    } catch (e) {
      console.error('Error parsing trial events:', e)
      return []
    }
  }

  // Sync settingsForm when tournament data changes (e.g., after router.refresh())
  useEffect(() => {
    const parsedEventsRun = tournament.eventsRun ? (() => {
      try {
        return JSON.parse(tournament.eventsRun) as string[]
      } catch (e) {
        console.error('Error parsing eventsRun:', e)
        return []
      }
    })() : []
    const parsedTrialEvents = parseTrialEvents(tournament.trialEvents)
    
    setSettingsForm(prev => ({
      ...prev,
      eventsRun: parsedEventsRun,
      trialEvents: parsedTrialEvents,
    }))
    
    // Also sync eventsDialogForm if dialog is open to keep them in sync
    if (eventsDialogOpen) {
      setEventsDialogForm({
        eventsRun: parsedEventsRun,
        trialEvents: parsedTrialEvents,
      })
    }
  }, [tournament.eventsRun, tournament.trialEvents, tournament.division, eventsDialogOpen])

  // Sync events dialog form when dialog opens
  // Note: The main sync happens in the settingsForm useEffect above to keep both forms in sync
  useEffect(() => {
    if (eventsDialogOpen) {
      const parsedEventsRun = tournament.eventsRun ? (() => {
        try {
          return JSON.parse(tournament.eventsRun) as string[]
        } catch (e) {
          console.error('Error parsing eventsRun:', e)
          return []
        }
      })() : []
      const parsedTrialEvents = parseTrialEvents(tournament.trialEvents)
      
      setEventsDialogForm({
        eventsRun: parsedEventsRun,
        trialEvents: parsedTrialEvents,
      })
      setNewTrialEventDialog({ name: '', division: defaultTrialEventDivision })
    }
  }, [eventsDialogOpen, tournament.eventsRun, tournament.trialEvents, tournament.division, defaultTrialEventDivision])

  // Events tab state
  const [eventsWithTests, setEventsWithTests] = useState<Array<{
    event: { id: string; name: string; division: string }
    tests: Array<{
      id: string
      name: string
      description: string | null
      instructions: string | null
      durationMinutes: number
      status: string
      eventId: string | null
      event: { id: string; name: string } | null
      staff?: { id: string; name: string | null; email: string }
      createdBy?: { id: string; name: string | null; email: string }
      updatedAt: string
      createdAt: string
      allowNoteSheet: boolean
      autoApproveNoteSheet: boolean
      questions: Array<{
        id: string
        type: string
        promptMd: string
        explanation: string | null
        points: number
        order: number
        options: Array<{ id: string; label: string; isCorrect: boolean; order: number }>
      }>
    }>
  }>>([])
  const [noteSheetReviewOpen, setNoteSheetReviewOpen] = useState<string | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string
    testId: string
    testName: string
    eventName?: string | null
    testType: 'Test' | 'ESTest'
    action: string
    actorName: string
    actorEmail: string
    createdAt: string
    details: any
  }>>([])
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false)
  const [showAuditLogs, setShowAuditLogs] = useState(false)
  const [auditLogSearch, setAuditLogSearch] = useState('')
  const [auditLogSort, setAuditLogSort] = useState<'newest' | 'oldest'>('newest')

  // Helper function to highlight search keywords
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm || !text) return text
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  // Filter and sort audit logs
  const filteredAndSortedAuditLogs = auditLogs
    .filter(log => {
      if (!auditLogSearch) return true
      const searchLower = auditLogSearch.toLowerCase()
      return (
        log.testName.toLowerCase().includes(searchLower) ||
        (log.eventName && log.eventName.toLowerCase().includes(searchLower)) ||
        log.actorName.toLowerCase().includes(searchLower) ||
        log.actorEmail.toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return auditLogSort === 'newest' ? dateB - dateA : dateA - dateB
    })
  
  // Check if tournament is B&C
  const isBCTournament = tournament.division === 'B&C' || (typeof tournament.division === 'string' && tournament.division.includes('B') && tournament.division.includes('C'))
  
  // Determine default division for trial events based on tournament division
  const getDefaultTrialEventDivision = (): 'B' | 'C' => {
    if (tournament.division === 'C') return 'C'
    if (tournament.division === 'B') return 'B'
    // For B&C tournaments, default to C
    return 'C'
  }
  
  // For backward compatibility, convert old trial events format (string[]) to new format ({ name, division }[])
  const normalizedTrialEvents = useMemo(() => {
    return settingsForm.trialEvents.map(event => {
      if (typeof event === 'string') {
        return { name: event, division: defaultTrialEventDivision } // Use tournament's default division
      }
      return event
    })
  }, [settingsForm.trialEvents, defaultTrialEventDivision])
  
  // Delete test dialog state
  const [deleteTestDialogOpen, setDeleteTestDialogOpen] = useState(false)
  const [testToDelete, setTestToDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deletingTest, setDeletingTest] = useState(false)

  const handleSignOut = () => {
    signOut({ callbackUrl: '/td' })
  }

  // Fetch default test settings
  const fetchDefaultTestSettings = async () => {
    setLoadingDefaultTestSettings(true)
    try {
      const res = await fetch(`/api/td/tournaments/${tournament.id}/default-test-settings`)
      if (res.ok) {
        const data = await res.json()
        setDefaultTestSettings(data.defaultTestSettings)
        // Populate form with existing values
        if (data.defaultTestSettings) {
          setDefaultTestSettingsForm({
            defaultDurationMinutes: data.defaultTestSettings.defaultDurationMinutes?.toString() || '',
            defaultStartAt: data.defaultTestSettings.defaultStartAt 
              ? new Date(data.defaultTestSettings.defaultStartAt).toISOString().slice(0, 16)
              : '',
            defaultEndAt: data.defaultTestSettings.defaultEndAt 
              ? new Date(data.defaultTestSettings.defaultEndAt).toISOString().slice(0, 16)
              : '',
            defaultReleaseScoresAt: data.defaultTestSettings.defaultReleaseScoresAt 
              ? new Date(data.defaultTestSettings.defaultReleaseScoresAt).toISOString().slice(0, 16)
              : '',
            defaultScoreReleaseMode: data.defaultTestSettings.defaultScoreReleaseMode || 'FULL_TEST',
            defaultRequireFullscreen: data.defaultTestSettings.defaultRequireFullscreen ?? true,
            defaultAllowCalculator: data.defaultTestSettings.defaultAllowCalculator ?? false,
            defaultCalculatorType: data.defaultTestSettings.defaultCalculatorType || 'FOUR_FUNCTION',
            defaultAllowNoteSheet: data.defaultTestSettings.defaultAllowNoteSheet ?? false,
            defaultAutoApproveNoteSheet: data.defaultTestSettings.defaultAutoApproveNoteSheet ?? true,
            defaultRequireOneSitting: data.defaultTestSettings.defaultRequireOneSitting ?? true,
            defaultMaxAttempts: data.defaultTestSettings.defaultMaxAttempts?.toString() || '',
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch default test settings:', error)
    } finally {
      setLoadingDefaultTestSettings(false)
    }
  }

  // Save default test settings
  const handleSaveDefaultTestSettings = async () => {
    setSavingDefaultTestSettings(true)
    try {
      const res = await fetch(`/api/td/tournaments/${tournament.id}/default-test-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultDurationMinutes: defaultTestSettingsForm.defaultDurationMinutes 
            ? parseInt(defaultTestSettingsForm.defaultDurationMinutes) 
            : null,
          defaultStartAt: defaultTestSettingsForm.defaultStartAt 
            ? new Date(defaultTestSettingsForm.defaultStartAt).toISOString()
            : null,
          defaultEndAt: defaultTestSettingsForm.defaultEndAt 
            ? new Date(defaultTestSettingsForm.defaultEndAt).toISOString()
            : null,
          defaultReleaseScoresAt: defaultTestSettingsForm.defaultReleaseScoresAt 
            ? new Date(defaultTestSettingsForm.defaultReleaseScoresAt).toISOString()
            : null,
          defaultScoreReleaseMode: defaultTestSettingsForm.defaultScoreReleaseMode || null,
          defaultRequireFullscreen: defaultTestSettingsForm.defaultRequireFullscreen,
          defaultAllowCalculator: defaultTestSettingsForm.defaultAllowCalculator,
          defaultCalculatorType: defaultTestSettingsForm.defaultAllowCalculator && defaultTestSettingsForm.defaultCalculatorType
            ? defaultTestSettingsForm.defaultCalculatorType
            : null,
          defaultAllowNoteSheet: defaultTestSettingsForm.defaultAllowNoteSheet,
          defaultAutoApproveNoteSheet: defaultTestSettingsForm.defaultAllowNoteSheet && defaultTestSettingsForm.defaultAutoApproveNoteSheet,
          defaultRequireOneSitting: defaultTestSettingsForm.defaultRequireOneSitting,
          defaultMaxAttempts: defaultTestSettingsForm.defaultMaxAttempts 
            ? parseInt(defaultTestSettingsForm.defaultMaxAttempts) 
            : null,
        }),
      })

      if (res.ok) {
        toast({
          title: 'Default test settings saved',
          description: 'These settings will be applied when tests are published.',
        })
        setIsEditingDefaultTestSettings(false)
        await fetchDefaultTestSettings()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save default test settings')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save default test settings',
        variant: 'destructive',
      })
    } finally {
      setSavingDefaultTestSettings(false)
    }
  }

  // Fetch default test settings on mount
  useEffect(() => {
    fetchDefaultTestSettings()
  }, [tournament.id])

  // Fetch staff
  const fetchStaff = async () => {
    setLoadingStaff(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/staff`)
      if (res.ok) {
        const data = await res.json()
        setStaff(data.staff)
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    } finally {
      setLoadingStaff(false)
    }
  }

  // Toggle publish status
  const togglePublish = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !isPublished }),
      })
      if (res.ok) {
        setIsPublished(!isPublished)
        toast({
          title: !isPublished ? 'Tournament Published' : 'Tournament Unpublished',
          description: !isPublished 
            ? 'Your tournament page is now visible to the public.' 
            : 'Your tournament page is now hidden from the public.',
        })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update publish status')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update publish status',
        variant: 'destructive',
      })
    } finally {
      setPublishing(false)
    }
  }

  // Fetch timeline
  const fetchTimeline = async () => {
    setLoadingTimeline(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/timeline`)
      if (res.ok) {
        const data = await res.json()
        setTimeline(data.timeline)
      }
    } catch (error) {
      console.error('Failed to fetch timeline:', error)
    } finally {
      setLoadingTimeline(false)
    }
  }

  const fetchRegistrations = async () => {
    setLoadingRegistrations(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`)
      if (res.ok) {
        const data = await res.json()
        setRegistrations(data.tournament.registrations || [])
      }
    } catch (error) {
      console.error('Failed to fetch registrations:', error)
      toast({
        title: 'Error',
        description: 'Failed to load registrations',
        variant: 'destructive',
      })
    } finally {
      setLoadingRegistrations(false)
    }
  }

  const handleInviteStaff = async () => {
    if (!inviteForm.email) return

    setInviting(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email,
          name: inviteForm.name || undefined,
          role: inviteForm.role,
          eventIds: inviteForm.role === 'EVENT_SUPERVISOR' ? inviteForm.eventIds : [],
          trialEventNames: inviteForm.role === 'EVENT_SUPERVISOR' ? inviteForm.trialEventNames : [],
        }),
      })

      if (res.ok) {
        toast({
          title: 'Invitation sent',
          description: `An invitation has been sent to ${inviteForm.email}`,
        })
        setInviteDialogOpen(false)
        setInviteForm({ email: '', name: '', role: 'EVENT_SUPERVISOR', eventIds: [], trialEventNames: [] })
        fetchStaff()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send invitation')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation',
        variant: 'destructive',
      })
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveStaff = async (staffId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/staff?staffId=${staffId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({
          title: 'Staff removed',
          description: 'The staff member has been removed from this tournament.',
        })
        fetchStaff()
      } else {
        throw new Error('Failed to remove staff')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove staff member',
        variant: 'destructive',
      })
    }
  }

  const handleOpenEditStaff = (member: StaffMember) => {
    setEditingStaff(member)
    const trialEvents = member.trialEvents ? JSON.parse(member.trialEvents) as string[] : []
    setEditStaffForm({
      role: member.role,
      eventIds: member.role === 'EVENT_SUPERVISOR'
        ? member.events.map(e => e.event.id)
        : [],
      trialEventNames: member.role === 'EVENT_SUPERVISOR' ? trialEvents : [],
    })
    setEditStaffDialogOpen(true)
  }

  const handleEditStaffDialogChange = (open: boolean) => {
    setEditStaffDialogOpen(open)
    if (!open) {
      setEditingStaff(null)
      setEditStaffForm({
        role: 'EVENT_SUPERVISOR',
        eventIds: [],
        trialEventNames: [],
      })
    }
  }

  const handleUpdateStaff = async () => {
    if (!editingStaff) return

    setUpdatingStaff(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/staff`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: editingStaff.id,
          role: editStaffForm.role,
          eventIds: editStaffForm.role === 'EVENT_SUPERVISOR' ? editStaffForm.eventIds : [],
          trialEventNames: editStaffForm.role === 'EVENT_SUPERVISOR' ? editStaffForm.trialEventNames : [],
        }),
      })

      if (res.ok) {
        toast({
          title: 'Staff updated',
          description: `${editingStaff.name || editingStaff.email} has been updated.`,
        })
        handleEditStaffDialogChange(false)
        fetchStaff()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update staff')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update staff member',
        variant: 'destructive',
      })
    } finally {
      setUpdatingStaff(false)
    }
  }

  const handleEmailClubAdmins = (registration: Registration) => {
    const adminEmails = registration.club.memberships
      .map((m) => m.user.email)
      .filter(Boolean)
      .join(',')

    if (!adminEmails) {
      toast({
        title: 'No admins found',
        description: 'This club has no admin emails available.',
        variant: 'destructive',
      })
      return
    }

    const subject = encodeURIComponent(`${tournament.name} - Tournament Communication`)
    const mailtoLink = `mailto:${adminEmails}?subject=${subject}`
    window.location.href = mailtoLink
  }

  const toggleRegistrationExpansion = (registrationId: string) => {
    setExpandedRegistrations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(registrationId)) {
        newSet.delete(registrationId)
      } else {
        newSet.add(registrationId)
      }
      return newSet
    })
  }

  // Filter registrations based on search query
  const filteredRegistrations = registrations.filter((reg) => {
    if (!teamsSearchQuery.trim()) return true
    
    const query = teamsSearchQuery.toLowerCase().trim()
    const clubName = reg.club.name.toLowerCase()
    const teamName = reg.team?.name.toLowerCase() || ''
    
    return clubName.includes(query) || teamName.includes(query)
  })

  const handleEmailAllClubAdmins = () => {
    if (registrations.length === 0) {
      toast({
        title: 'No registrations',
        description: 'There are no registered teams to email.',
        variant: 'destructive',
      })
      return
    }

    // Collect all unique admin emails from all registrations
    const allAdminEmails = new Set<string>()
    registrations.forEach((reg) => {
      reg.club.memberships.forEach((m) => {
        if (m.user.email) {
          allAdminEmails.add(m.user.email)
        }
      })
    })

    if (allAdminEmails.size === 0) {
      toast({
        title: 'No admins found',
        description: 'No admin emails available for registered clubs.',
        variant: 'destructive',
      })
      return
    }

    const emailList = Array.from(allAdminEmails).join(',')
    const subject = encodeURIComponent(`${tournament.name} - Tournament Communication`)
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(emailList)}&subject=${subject}`
    window.location.href = mailtoLink
  }

  const handleEmailAllStaff = () => {
    if (staff.length === 0) {
      toast({
        title: 'No staff members',
        description: 'There are no staff members to email.',
        variant: 'destructive',
      })
      return
    }

    // Separate Tournament Directors and Event Supervisors
    const tournamentDirectors = staff.filter((m: StaffMember) => m.role === 'TOURNAMENT_DIRECTOR')
    const eventSupervisors = staff.filter((m: StaffMember) => m.role === 'EVENT_SUPERVISOR')
    
    // Get emails - use user email if available, otherwise use the invitation email
    const tdEmails = tournamentDirectors
      .map((m: StaffMember) => m.user?.email || m.email)
      .filter(Boolean)
      .join(',')
    const esEmails = eventSupervisors
      .map((m: StaffMember) => m.user?.email || m.email)
      .filter(Boolean)
      .join(',')
    
    // CC Tournament Directors, BCC Event Supervisors
    const mailtoLink = `mailto:?cc=${encodeURIComponent(tdEmails)}&bcc=${encodeURIComponent(esEmails)}&subject=${encodeURIComponent(`${tournament.name} - Staff Communication`)}`
    window.location.href = mailtoLink
  }

  const resetTimelineForm = () => {
    setTimelineForm({ name: '', description: '', dueDate: '', type: 'draft_due' })
    setEditingTimelineItem(null)
  }

  const toLocalDateTimeInput = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const tzAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return tzAdjusted.toISOString().slice(0, 16)
  }

  const handleOpenAddTimeline = () => {
    resetTimelineForm()
    setTimelineDialogOpen(true)
  }

  const handleOpenEditTimeline = (item: TimelineItem) => {
    setEditingTimelineItem(item)
    setTimelineForm({
      name: item.name,
      description: item.description || '',
      dueDate: toLocalDateTimeInput(item.dueDate),
      type: item.type || 'draft_due',
    })
    setTimelineDialogOpen(true)
  }

  const handleTimelineDialogChange = (open: boolean) => {
    setTimelineDialogOpen(open)
    if (!open) {
      resetTimelineForm()
    }
  }

  const handleSaveTimeline = async () => {
    if (!timelineForm.name || !timelineForm.dueDate) return

    setSavingTimeline(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/timeline`, {
        method: editingTimelineItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingTimelineItem
            ? { id: editingTimelineItem.id, ...timelineForm }
            : timelineForm
        ),
      })

      if (res.ok) {
        toast({
          title: editingTimelineItem ? 'Deadline updated' : 'Deadline added',
          description: editingTimelineItem ? 'The timeline item has been updated.' : 'The timeline item has been added.',
        })
        handleTimelineDialogChange(false)
        fetchTimeline()
      } else {
        throw new Error('Failed to save timeline item')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save timeline item',
        variant: 'destructive',
      })
    } finally {
      setSavingTimeline(false)
    }
  }

  const handleDeleteTimeline = async (timelineId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/timeline?id=${timelineId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({
          title: 'Deadline removed',
          description: 'The timeline item has been removed.',
        })
        fetchTimeline()
      } else {
        throw new Error('Failed to remove timeline item')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove timeline item',
        variant: 'destructive',
      })
    }
  }

  const handleSaveSettings = async () => {
    // Validate all date/time fields before saving
    const errors: typeof settingsFormErrors = {}
    
    // Validate tournament start/end date and time
    if (settingsForm.startDate && settingsForm.endDate) {
      const startDateTime = settingsForm.startDate && settingsForm.startTime
        ? new Date(`${settingsForm.startDate}T${settingsForm.startTime}`)
        : new Date(settingsForm.startDate)
      const endDateTime = settingsForm.endDate && settingsForm.endTime
        ? new Date(`${settingsForm.endDate}T${settingsForm.endTime}`)
        : new Date(settingsForm.endDate)
      if (endDateTime <= startDateTime) {
        errors.endDate = 'End date/time must be after start date/time'
        errors.endTime = 'End date/time must be after start date/time'
      }
    }
    
    // Validate registration dates
    if (settingsForm.registrationStartDate && settingsForm.registrationEndDate) {
      const regStart = new Date(settingsForm.registrationStartDate)
      const regEnd = new Date(settingsForm.registrationEndDate)
      if (regEnd <= regStart) {
        errors.registrationEndDate = 'Registration end date must be after start date'
      }
    }
    
    // Validate early bird deadline (should be before registration end date if both exist)
    if (settingsForm.earlyBirdDeadline && settingsForm.registrationEndDate) {
      const earlyBird = new Date(settingsForm.earlyBirdDeadline)
      const regEnd = new Date(settingsForm.registrationEndDate)
      if (earlyBird >= regEnd) {
        errors.earlyBirdDeadline = 'Early bird deadline must be before registration end date'
      }
    }
    
    // Validate late fee start date (should be after registration start date if both exist)
    if (settingsForm.lateFeeStartDate && settingsForm.registrationStartDate) {
      const lateFeeStart = new Date(settingsForm.lateFeeStartDate)
      const regStart = new Date(settingsForm.registrationStartDate)
      if (lateFeeStart <= regStart) {
        errors.lateFeeStartDate = 'Late fee start date must be after registration start date'
      }
    }
    
    // If there are errors, show them and prevent saving
    if (Object.values(errors).some(err => err !== undefined)) {
      setSettingsFormErrors(errors)
      toast({
        title: 'Validation Error',
        description: 'Please fix the date/time errors before saving',
        variant: 'destructive',
      })
      setSavingSettings(false)
      return
    }
    
    setSavingSettings(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: settingsForm.startDate && settingsForm.startTime 
            ? new Date(`${settingsForm.startDate}T${settingsForm.startTime}`).toISOString() 
            : null,
          endTime: settingsForm.endDate && settingsForm.endTime 
            ? new Date(`${settingsForm.endDate}T${settingsForm.endTime}`).toISOString() 
            : null,
          // Extract date-only values from the combined datetime to ensure consistency
          // Use the date from the local time representation to match what users see
          startDate: settingsForm.startDate && settingsForm.startTime 
            ? (() => {
                const dt = new Date(`${settingsForm.startDate}T${settingsForm.startTime}`)
                // Get date components in local timezone (what user entered)
                const year = dt.getFullYear()
                const month = dt.getMonth()
                const day = dt.getDate()
                // Create UTC date at midnight for that date to avoid timezone shifts
                return new Date(Date.UTC(year, month, day)).toISOString()
              })()
            : settingsForm.startDate ? new Date(settingsForm.startDate + 'T00:00:00').toISOString() : null,
          endDate: settingsForm.endDate && settingsForm.endTime 
            ? (() => {
                const dt = new Date(`${settingsForm.endDate}T${settingsForm.endTime}`)
                // Get date components in local timezone (what user entered)
                const year = dt.getFullYear()
                const month = dt.getMonth()
                const day = dt.getDate()
                // Create UTC date at midnight for that date to avoid timezone shifts
                return new Date(Date.UTC(year, month, day)).toISOString()
              })()
            : settingsForm.endDate ? new Date(settingsForm.endDate + 'T00:00:00').toISOString() : null,
          price: settingsForm.price ? parseFloat(settingsForm.price) : 0,
          additionalTeamPrice: settingsForm.additionalTeamPrice ? parseFloat(settingsForm.additionalTeamPrice) : null,
          feeStructure: settingsForm.feeStructure,
          registrationStartDate: settingsForm.registrationStartDate ? new Date(settingsForm.registrationStartDate).toISOString() : null,
          registrationEndDate: settingsForm.registrationEndDate ? new Date(settingsForm.registrationEndDate).toISOString() : null,
          earlyBirdDiscount: settingsForm.earlyBirdDiscount ? parseFloat(settingsForm.earlyBirdDiscount) : null,
          earlyBirdDeadline: settingsForm.earlyBirdDeadline ? new Date(settingsForm.earlyBirdDeadline).toISOString() : null,
          lateFee: settingsForm.lateFee ? parseFloat(settingsForm.lateFee) : null,
          lateFeeStartDate: settingsForm.lateFeeStartDate ? new Date(settingsForm.lateFeeStartDate).toISOString() : null,
          otherDiscounts: settingsForm.otherDiscounts.length > 0 ? JSON.stringify(settingsForm.otherDiscounts) : null,
          eligibilityRequirements: settingsForm.eligibilityRequirements || null,
          eventsRun: settingsForm.eventsRun.length > 0 ? JSON.stringify(settingsForm.eventsRun) : null,
          trialEvents: JSON.stringify(settingsForm.trialEvents),
        }),
      })

      if (res.ok) {
        toast({
          title: 'Settings saved',
          description: 'Tournament settings have been updated.',
        })
        setIsEditingSettings(false)
        setSettingsFormErrors({}) // Clear errors on success
        // Update eventsDialogForm if it exists to keep them in sync
        setEventsDialogForm(prev => ({
          ...prev,
          eventsRun: settingsForm.eventsRun,
          trialEvents: settingsForm.trialEvents,
        }))
        router.refresh()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleAddOtherDiscount = () => {
    const amountValue = parseFloat(newDiscount.amount)
    if (!newDiscount.condition || Number.isNaN(amountValue)) return
    if (amountValue < 0) {
      toast({
        title: 'Invalid discount',
        description: 'Discount amount cannot be negative.',
        variant: 'destructive',
      })
      return
    }

    setSettingsForm(prev => ({
      ...prev,
      otherDiscounts: [...prev.otherDiscounts, { condition: newDiscount.condition, amount: amountValue }],
    }))
    setNewDiscount({ condition: '', amount: '' })
  }

  const handleRemoveOtherDiscount = (index: number) => {
    setSettingsForm(prev => ({
      ...prev,
      otherDiscounts: prev.otherDiscounts.filter((_, i) => i !== index),
    }))
  }

  const handleToggleEvent = (eventId: string) => {
    setSettingsForm(prev => ({
      ...prev,
      eventsRun: prev.eventsRun.includes(eventId)
        ? prev.eventsRun.filter(id => id !== eventId)
        : [...prev.eventsRun, eventId],
    }))
  }

  const handleSelectAllEvents = () => {
    setSettingsForm(prev => ({
      ...prev,
      eventsRun: prev.eventsRun.length === events.length
        ? []
        : events.map(e => e.id),
    }))
  }

  const handleSelectAllDivisionB = () => {
    const divisionBEvents = events.filter(e => e.division === 'B')
    const allBSelected = divisionBEvents.every(e => settingsForm.eventsRun.includes(e.id))
    setSettingsForm(prev => ({
      ...prev,
      eventsRun: allBSelected
        ? prev.eventsRun.filter(id => !divisionBEvents.some(e => e.id === id))
        : [...prev.eventsRun.filter(id => !divisionBEvents.some(e => e.id === id)), ...divisionBEvents.map(e => e.id)],
    }))
  }

  const handleSelectAllDivisionC = () => {
    const divisionCEvents = events.filter(e => e.division === 'C')
    const allCSelected = divisionCEvents.every(e => settingsForm.eventsRun.includes(e.id))
    setSettingsForm(prev => ({
      ...prev,
      eventsRun: allCSelected
        ? prev.eventsRun.filter(id => !divisionCEvents.some(e => e.id === id))
        : [...prev.eventsRun.filter(id => !divisionCEvents.some(e => e.id === id)), ...divisionCEvents.map(e => e.id)],
    }))
  }

  // Events dialog handlers
  const handleSaveEventsDialog = async () => {
    setSavingEventsDialog(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventsRun: eventsDialogForm.eventsRun.length > 0 ? JSON.stringify(eventsDialogForm.eventsRun) : null,
          trialEvents: eventsDialogForm.trialEvents.length > 0 ? JSON.stringify(eventsDialogForm.trialEvents) : JSON.stringify([]),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        
        // If the API returned updated tournament data, use it to sync forms
        if (data.tournament) {
          const updatedTrialEvents = data.tournament.trialEvents ? (() => {
            try {
              const parsed = JSON.parse(data.tournament.trialEvents)
              const defaultDivision = tournament.division === 'C' ? 'C' : tournament.division === 'B' ? 'B' : 'C'
              if (Array.isArray(parsed) && parsed.length > 0) {
                if (typeof parsed[0] === 'string') {
                  return parsed.map((name: string) => ({ name, division: defaultDivision }))
                }
                return parsed as Array<{ name: string; division: string }>
              }
              return [] as Array<{ name: string; division: string }>
            } catch (e) {
              console.error('Error parsing trial events from API response:', e)
              return eventsDialogForm.trialEvents
            }
          })() : []
          
          const updatedEventsRun = data.tournament.eventsRun ? (() => {
            try {
              return JSON.parse(data.tournament.eventsRun) as string[]
            } catch (e) {
              console.error('Error parsing eventsRun from API response:', e)
              return eventsDialogForm.eventsRun
            }
          })() : []
          
          // Update both forms with the data from the API response
          setSettingsForm(prev => ({
            ...prev,
            eventsRun: updatedEventsRun,
            trialEvents: updatedTrialEvents,
          }))
          
          setEventsDialogForm({
            eventsRun: updatedEventsRun,
            trialEvents: updatedTrialEvents,
          })
        } else {
          // Fallback: update settingsForm with current dialog form data
          setSettingsForm(prev => ({
            ...prev,
            eventsRun: eventsDialogForm.eventsRun,
            trialEvents: eventsDialogForm.trialEvents,
          }))
        }
        
        toast({
          title: 'Events saved',
          description: 'Tournament events have been updated.',
        })
        
        setEventsDialogOpen(false)
        
        // Refresh to get updated tournament data from server
        // The useEffect will sync both forms from tournament data after refresh
        router.refresh()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save events')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save events',
        variant: 'destructive',
      })
    } finally {
      setSavingEventsDialog(false)
    }
  }

  const handleToggleEventDialog = (eventId: string) => {
    setEventsDialogForm(prev => ({
      ...prev,
      eventsRun: prev.eventsRun.includes(eventId)
        ? prev.eventsRun.filter(id => id !== eventId)
        : [...prev.eventsRun, eventId],
    }))
  }

  const handleSelectAllDivisionBDialog = () => {
    const divisionBEvents = events.filter(e => e.division === 'B')
    const allBSelected = divisionBEvents.every(e => eventsDialogForm.eventsRun.includes(e.id))
    setEventsDialogForm(prev => ({
      ...prev,
      eventsRun: allBSelected
        ? prev.eventsRun.filter(id => !divisionBEvents.some(e => e.id === id))
        : [...prev.eventsRun.filter(id => !divisionBEvents.some(e => e.id === id)), ...divisionBEvents.map(e => e.id)],
    }))
  }

  const handleSelectAllDivisionCDialog = () => {
    const divisionCEvents = events.filter(e => e.division === 'C')
    const allCSelected = divisionCEvents.every(e => eventsDialogForm.eventsRun.includes(e.id))
    setEventsDialogForm(prev => ({
      ...prev,
      eventsRun: allCSelected
        ? prev.eventsRun.filter(id => !divisionCEvents.some(e => e.id === id))
        : [...prev.eventsRun.filter(id => !divisionCEvents.some(e => e.id === id)), ...divisionCEvents.map(e => e.id)],
    }))
  }

  const normalizedTrialEventsDialog = useMemo(() => {
    return eventsDialogForm.trialEvents.map(event => {
      if (typeof event === 'string') {
        return { name: event, division: defaultTrialEventDivision }
      }
      return event
    })
  }, [eventsDialogForm.trialEvents, defaultTrialEventDivision])

  // Fetch events with tests
  const fetchEventsWithTests = async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/td/tournaments/${tournament.id}/tests`)
      if (res.ok) {
        const data = await res.json()
        setEventsWithTests(data.events || [])
      } else {
        // Try to get error message from response
        let errorMessage = 'Failed to fetch events and tests'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If response isn't JSON, use default message
        }
        console.error('Failed to fetch events and tests:', res.status, errorMessage)
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to fetch events with tests:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch events and tests',
        variant: 'destructive',
      })
    } finally {
      setLoadingEvents(false)
    }
  }

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setLoadingAuditLogs(true)
    try {
      const res = await fetch(`/api/td/tournaments/${tournament.id}/audit-logs?t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setAuditLogs(data.auditLogs || [])
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch audit logs',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch audit logs',
        variant: 'destructive',
      })
    } finally {
      setLoadingAuditLogs(false)
    }
  }

  // Release all scores for the tournament
  const handleReleaseAllScores = async () => {
    if (!tournamentEnded) {
      toast({
        title: 'Cannot Release Scores',
        description: 'Scores can only be released after the tournament has ended.',
        variant: 'destructive',
      })
      return
    }
    
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/release-all-scores`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        toast({
          title: 'Success',
          description: data.message || 'All scores released successfully',
        })
        // Refresh events to show updated status
        fetchEventsWithTests()
      } else {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to release scores')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to release scores',
        variant: 'destructive',
      })
    }
  }

  // Release scores for a specific event
  const handleReleaseEventScores = async (eventId: string | null, eventName: string) => {
    if (!tournamentEnded) {
      toast({
        title: 'Cannot Release Scores',
        description: 'Scores can only be released after the tournament has ended.',
        variant: 'destructive',
      })
      return
    }
    
    try {
      let res: Response
      if (eventId === null) {
        // Trial event - use trial event endpoint
        res = await fetch(`/api/tournaments/${tournament.id}/trial-events/${encodeURIComponent(eventName)}/release-scores`, {
          method: 'POST',
        })
      } else {
        // Regular event
        res = await fetch(`/api/tournaments/${tournament.id}/events/${eventId}/release-scores`, {
          method: 'POST',
        })
      }

      if (res.ok) {
        const data = await res.json()
        toast({
          title: 'Success',
          description: data.message || `Scores released for ${eventName}`,
        })
        // Refresh events to show updated status
        fetchEventsWithTests()
      } else {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to release scores')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to release scores',
        variant: 'destructive',
      })
    }
  }

  // Auto-refresh audit logs when modal is open (silently in background)
  useEffect(() => {
    if (!showAuditLogs) return

    // Fetch immediately when opened
    fetchAuditLogs()

    // Set up auto-refresh every 5 seconds (silent, no loading indicator)
    const interval = setInterval(() => {
      // Fetch without showing loading state for auto-refresh
      fetch(`/api/td/tournaments/${tournament.id}/audit-logs?t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          setAuditLogs(data.auditLogs || [])
        })
        .catch(err => {
          console.error('Auto-refresh audit logs error:', err)
        })
    }, 5000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuditLogs])

  // Fetch events when events tab is activated
  useEffect(() => {
    if (activeTab === 'events' && eventsWithTests.length === 0) {
      fetchEventsWithTests()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Fetch registrations when teams tab is activated
  useEffect(() => {
    if (activeTab === 'teams') {
      fetchRegistrations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Delete test handlers
  const handleDeleteTestClick = (test: { id: string; name: string }) => {
    setTestToDelete(test)
    setDeleteTestDialogOpen(true)
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
      fetchEventsWithTests()
    } catch (error: any) {
      console.error('Failed to duplicate test:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate test',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteTestConfirm = async () => {
    if (!testToDelete) return

    setDeletingTest(true)
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

      setDeleteTestDialogOpen(false)
      setTestToDelete(null)
      
      // Refresh tests list
      fetchEventsWithTests()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete test',
        variant: 'destructive',
      })
    } finally {
      setDeletingTest(false)
    }
  }

  return (
    <div className="min-h-screen bg-background grid-pattern flex flex-col">
      {/* Header */}
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" href="/" variant="light" />
            <div className="h-6 w-px bg-white/20" />
            <span className="text-white font-semibold">TD Portal</span>
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
        {/* Back Button and Tournament Info */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/td')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">{tournament.name}</CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(tournament.startDate), 'MMM d, yyyy')}
                    </span>
                    {tournament.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {tournament.location}
                      </span>
                    )}
                    <Badge variant="outline">Division {formatDivision(tournament.division)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={togglePublish}
                    disabled={publishing}
                    variant={isPublished ? "outline" : "default"}
                    size="sm"
                    className={isPublished ? "" : "bg-green-600 hover:bg-green-700 text-white"}
                  >
                    {publishing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : isPublished ? (
                      <Lock className="h-4 w-4 mr-2" />
                    ) : (
                      <Globe className="h-4 w-4 mr-2" />
                    )}
                    {publishing ? 'Updating...' : isPublished ? 'Unpublish' : 'Publish'}
                  </Button>
                  {tournament.slug && isPublished && (
                    <Link href={`/tournaments/${tournament.slug}`} target="_blank">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Public Page
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardHeader>
            {!isPublished && (
              <CardContent className="pt-0">
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <strong>Not Published:</strong> Your tournament page is currently hidden from the public. Click &quot;Publish&quot; to make it visible.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Tabs */}
        {isHydrated && (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="staff" className="gap-2">
              <Users className="h-4 w-4" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Trophy className="h-4 w-4" />
              Teams
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Staff Tab */}
          <TabsContent value="staff" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Staff Management
                    </CardTitle>
                    <CardDescription>
                      Invite Event Supervisors and Tournament Directors
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {staff.length > 0 && (
                      <Button variant="outline" onClick={handleEmailAllStaff}>
                        <Mail className="h-4 w-4 mr-2" />
                        Email All
                      </Button>
                    )}
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite Staff
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Invite Staff Member</DialogTitle>
                        <DialogDescription>
                          Send an invitation to join as Event Supervisor or Tournament Director.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={inviteForm.email}
                            onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="staff@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Name (optional)</Label>
                          <Input
                            id="name"
                            value={inviteForm.name}
                            onChange={e => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="John Doe"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select
                            value={inviteForm.role}
                            onValueChange={(value: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR') => 
                              setInviteForm(prev => ({ ...prev, role: value, eventIds: [] }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EVENT_SUPERVISOR">Event Supervisor</SelectItem>
                              <SelectItem value="TOURNAMENT_DIRECTOR">Tournament Director</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {inviteForm.role === 'EVENT_SUPERVISOR' && events.length > 0 && (
                          <div className="space-y-2">
                            <Label>Assign Events</Label>
                            <div className={`grid gap-4 ${(tournament.division === 'B' || tournament.division === 'C') ? 'grid-cols-1' : 'grid-cols-2'}`}>
                              {/* Division B Events */}
                              {(tournament.division === 'B' || tournament.division === 'B&C') && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-foreground">Division B</h4>
                                    {events.filter(e => e.division === 'B').length > 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const divisionBEvents = events.filter(e => e.division === 'B')
                                          const allBSelected = divisionBEvents.every(e => inviteForm.eventIds.includes(e.id))
                                          setInviteForm(prev => ({
                                            ...prev,
                                            eventIds: allBSelected
                                              ? prev.eventIds.filter(id => !divisionBEvents.some(e => e.id === id))
                                              : [...prev.eventIds.filter(id => !divisionBEvents.some(e => e.id === id)), ...divisionBEvents.map(e => e.id)],
                                          }))
                                        }}
                                        className="h-7 text-xs"
                                      >
                                        {events.filter(e => e.division === 'B').every(e => inviteForm.eventIds.includes(e.id)) ? 'Deselect All' : 'Select All'}
                                      </Button>
                                    )}
                                  </div>
                                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                                    {events.filter(e => e.division === 'B').sort((a, b) => a.name.localeCompare(b.name)).map(event => (
                                      <label 
                                        key={event.id} 
                                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                                      >
                                        <Checkbox
                                          checked={inviteForm.eventIds.includes(event.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setInviteForm(prev => ({ 
                                                ...prev, 
                                                eventIds: [...prev.eventIds, event.id] 
                                              }))
                                            } else {
                                              setInviteForm(prev => ({ 
                                                ...prev, 
                                                eventIds: prev.eventIds.filter(id => id !== event.id) 
                                              }))
                                            }
                                          }}
                                        />
                                        <span>{event.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Division C Events */}
                              {(tournament.division === 'C' || tournament.division === 'B&C') && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-foreground">Division C</h4>
                                    {events.filter(e => e.division === 'C').length > 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const divisionCEvents = events.filter(e => e.division === 'C')
                                          const allCSelected = divisionCEvents.every(e => inviteForm.eventIds.includes(e.id))
                                          setInviteForm(prev => ({
                                            ...prev,
                                            eventIds: allCSelected
                                              ? prev.eventIds.filter(id => !divisionCEvents.some(e => e.id === id))
                                              : [...prev.eventIds.filter(id => !divisionCEvents.some(e => e.id === id)), ...divisionCEvents.map(e => e.id)],
                                          }))
                                        }}
                                        className="h-7 text-xs"
                                      >
                                        {events.filter(e => e.division === 'C').every(e => inviteForm.eventIds.includes(e.id)) ? 'Deselect All' : 'Select All'}
                                      </Button>
                                    )}
                                  </div>
                                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                                    {events.filter(e => e.division === 'C').sort((a, b) => a.name.localeCompare(b.name)).map(event => (
                                      <label 
                                        key={event.id} 
                                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                                      >
                                        <Checkbox
                                          checked={inviteForm.eventIds.includes(event.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setInviteForm(prev => ({ 
                                                ...prev, 
                                                eventIds: [...prev.eventIds, event.id] 
                                              }))
                                            } else {
                                              setInviteForm(prev => ({ 
                                                ...prev, 
                                                eventIds: prev.eventIds.filter(id => id !== event.id) 
                                              }))
                                            }
                                          }}
                                        />
                                        <span>{event.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Trial Events */}
                              {normalizedTrialEvents.length > 0 && (
                                <div className="space-y-2 mt-4">
                                  <div className="flex items-center justify-between">
                                    <Label>Trial Events</Label>
                                  </div>
                                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                                    {normalizedTrialEvents.map((trialEvent, index) => (
                                      <label 
                                        key={index} 
                                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                                      >
                                        <Checkbox
                                          checked={inviteForm.trialEventNames.includes(trialEvent.name)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setInviteForm(prev => ({ 
                                                ...prev, 
                                                trialEventNames: [...prev.trialEventNames, trialEvent.name] 
                                              }))
                                            } else {
                                              setInviteForm(prev => ({ 
                                                ...prev, 
                                                trialEventNames: prev.trialEventNames.filter(name => name !== trialEvent.name) 
                                              }))
                                            }
                                          }}
                                        />
                                        <span className="flex items-center gap-2 flex-1 min-w-0">
                                          <span className="truncate">{trialEvent.name}</span>
                                          <Badge variant="outline" className="text-xs flex-shrink-0">
                                            Div {trialEvent.division}
                                          </Badge>
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleInviteStaff} 
                          disabled={inviting || !inviteForm.email}
                        >
                        <Send className="h-4 w-4 mr-2" />
                        {inviting ? 'Sending...' : 'Send Invitation'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingStaff ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                    <p>Loading staff...</p>
                  </div>
                ) : staff.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No staff members yet. Click &ldquo;Invite Staff&rdquo; to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staff.map(member => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.user?.image || ''} />
                            <AvatarFallback className="bg-primary/10">
                              {(member.name || member.email).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name || member.email}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="secondary" className="text-xs">
                                {member.role === 'EVENT_SUPERVISOR' ? 'ES' : 'TD'}
                              </Badge>
                              {member.events.length > 0 && (
                                <span>
                                  {[...member.events].sort((a, b) => a.event.name.localeCompare(b.event.name)).map(e => e.event.name).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.tests.length > 0 && (
                            <div 
                              className="relative"
                              onMouseEnter={() => setHoveredTestBadge(member.id)}
                              onMouseLeave={() => setHoveredTestBadge(null)}
                            >
                              <Badge variant="outline" className="whitespace-nowrap">
                                {member.tests.length} test{member.tests.length !== 1 ? 's' : ''}
                              </Badge>
                              {hoveredTestBadge === member.id && (
                                <div className="absolute bottom-full right-0 mb-2 z-50 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-bottom-1">
                                  <div className="space-y-2.5">
                                    {member.tests.map((test, index) => {
                                      const event = test.eventId ? events.find(e => e.id === test.eventId) : null
                                      return (
                                        <div key={test.id}>
                                          {index > 0 && <div className="h-px bg-border mb-2.5 -mt-1" />}
                                          <div className="flex flex-col gap-0.5">
                                            <p className="font-medium text-foreground">{test.name}</p>
                                            {event ? (
                                              <p className="text-xs text-muted-foreground">Event: {event.name}</p>
                                            ) : test.eventId ? (
                                              <p className="text-xs text-muted-foreground">Event: Unknown</p>
                                            ) : (
                                              <p className="text-xs text-muted-foreground">No event assigned</p>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  {/* Arrow pointing down */}
                                  <div className="absolute top-full right-4 -mt-1.5 w-2.5 h-2.5 bg-popover border-r border-b border-border transform rotate-45" />
                                </div>
                              )}
                            </div>
                          )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenEditStaff(member)}
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemoveStaff(member.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Dialog open={editStaffDialogOpen} onOpenChange={handleEditStaffDialogChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Staff Member</DialogTitle>
                  <DialogDescription>
                    Update the staff role and assigned events.
                  </DialogDescription>
                </DialogHeader>
                {editingStaff ? (
                  <div className="space-y-4 py-2">
                    <div>
                      <p className="font-semibold">{editingStaff.name || editingStaff.email}</p>
                      <p className="text-sm text-muted-foreground">{editingStaff.email}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-role">Role</Label>
                      <Select
                        value={editStaffForm.role}
                        onValueChange={(value: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR') =>
                          setEditStaffForm(prev => ({ ...prev, role: value, eventIds: [], trialEventNames: [] }))
                        }
                      >
                        <SelectTrigger id="edit-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EVENT_SUPERVISOR">Event Supervisor</SelectItem>
                          <SelectItem value="TOURNAMENT_DIRECTOR">Tournament Director</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editStaffForm.role === 'EVENT_SUPERVISOR' && events.length > 0 && (
                      <div className="space-y-2">
                        <Label>Assign Events</Label>
                        <div className={`grid gap-4 ${(tournament.division === 'B' || tournament.division === 'C') ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {/* Division B Events */}
                          {(tournament.division === 'B' || tournament.division === 'B&C') && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-foreground">Division B</h4>
                                {events.filter(e => e.division === 'B').length > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const divisionBEvents = events.filter(e => e.division === 'B')
                                      const allBSelected = divisionBEvents.every(e => editStaffForm.eventIds.includes(e.id))
                                      setEditStaffForm(prev => ({
                                        ...prev,
                                        eventIds: allBSelected
                                          ? prev.eventIds.filter(id => !divisionBEvents.some(e => e.id === id))
                                          : [...prev.eventIds.filter(id => !divisionBEvents.some(e => e.id === id)), ...divisionBEvents.map(e => e.id)],
                                      }))
                                    }}
                                    className="h-7 text-xs"
                                  >
                                    {events.filter(e => e.division === 'B').every(e => editStaffForm.eventIds.includes(e.id)) ? 'Deselect All' : 'Select All'}
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                                {events.filter(e => e.division === 'B').map(event => (
                                  <label 
                                    key={event.id} 
                                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                                  >
                                    <Checkbox
                                      checked={editStaffForm.eventIds.includes(event.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setEditStaffForm(prev => ({ 
                                            ...prev, 
                                            eventIds: [...prev.eventIds, event.id] 
                                          }))
                                        } else {
                                          setEditStaffForm(prev => ({ 
                                            ...prev, 
                                            eventIds: prev.eventIds.filter(id => id !== event.id) 
                                          }))
                                        }
                                      }}
                                    />
                                    <span>{event.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Division C Events */}
                          {(tournament.division === 'C' || tournament.division === 'B&C') && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-foreground">Division C</h4>
                                {events.filter(e => e.division === 'C').length > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const divisionCEvents = events.filter(e => e.division === 'C')
                                      const allCSelected = divisionCEvents.every(e => editStaffForm.eventIds.includes(e.id))
                                      setEditStaffForm(prev => ({
                                        ...prev,
                                        eventIds: allCSelected
                                          ? prev.eventIds.filter(id => !divisionCEvents.some(e => e.id === id))
                                          : [...prev.eventIds.filter(id => !divisionCEvents.some(e => e.id === id)), ...divisionCEvents.map(e => e.id)],
                                      }))
                                    }}
                                    className="h-7 text-xs"
                                  >
                                    {events.filter(e => e.division === 'C').every(e => editStaffForm.eventIds.includes(e.id)) ? 'Deselect All' : 'Select All'}
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                                {events.filter(e => e.division === 'C').map(event => (
                                  <label 
                                    key={event.id} 
                                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                                  >
                                    <Checkbox
                                      checked={editStaffForm.eventIds.includes(event.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setEditStaffForm(prev => ({ 
                                            ...prev, 
                                            eventIds: [...prev.eventIds, event.id] 
                                          }))
                                        } else {
                                          setEditStaffForm(prev => ({ 
                                            ...prev, 
                                            eventIds: prev.eventIds.filter(id => id !== event.id) 
                                          }))
                                        }
                                      }}
                                    />
                                    <span>{event.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Trial Events */}
                          {normalizedTrialEvents.length > 0 && (
                            <div className="space-y-2 mt-4">
                              <div className="flex items-center justify-between">
                                <Label>Trial Events</Label>
                              </div>
                              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                                {normalizedTrialEvents.map((trialEvent, index) => (
                                  <label 
                                    key={index} 
                                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                                  >
                                    <Checkbox
                                      checked={editStaffForm.trialEventNames.includes(trialEvent.name)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setEditStaffForm(prev => ({ 
                                            ...prev, 
                                            trialEventNames: [...prev.trialEventNames, trialEvent.name] 
                                          }))
                                        } else {
                                          setEditStaffForm(prev => ({ 
                                            ...prev, 
                                            trialEventNames: prev.trialEventNames.filter(name => name !== trialEvent.name) 
                                          }))
                                        }
                                      }}
                                    />
                                    <span className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="truncate">{trialEvent.name}</span>
                                      <Badge variant="outline" className="text-xs flex-shrink-0">
                                        Div {trialEvent.division}
                                      </Badge>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a staff member to edit.</p>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleEditStaffDialogChange(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpdateStaff} 
                    disabled={!editingStaff || updatingStaff}
                  >
                    {updatingStaff ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Timeline & Deadlines
                    </CardTitle>
                    <CardDescription>
                      Set deadlines for ES test submissions
                    </CardDescription>
                  </div>
                  <Dialog open={timelineDialogOpen} onOpenChange={handleTimelineDialogChange}>
                    <DialogTrigger asChild>
                      <Button variant="outline" onClick={handleOpenAddTimeline}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Deadline
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingTimelineItem ? 'Edit Timeline Item' : 'Add Timeline Item'}</DialogTitle>
                        <DialogDescription>
                          Create a deadline for your Event Supervisors.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="tl-name">Name *</Label>
                          <Input
                            id="tl-name"
                            value={timelineForm.name}
                            onChange={e => setTimelineForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Draft Tests Due"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tl-type">Type</Label>
                          <Select
                            value={timelineForm.type}
                            onValueChange={value => setTimelineForm(prev => ({ ...prev, type: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft_due">Draft Due</SelectItem>
                              <SelectItem value="final_due">Final Due</SelectItem>
                              <SelectItem value="review_due">Review Due</SelectItem>
                              <SelectItem value="meeting">Meeting</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tl-date">Due Date *</Label>
                          <Input
                            id="tl-date"
                            type="datetime-local"
                            value={timelineForm.dueDate}
                            onChange={e => setTimelineForm(prev => ({ ...prev, dueDate: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tl-desc">Description (optional)</Label>
                          <Textarea
                            id="tl-desc"
                            value={timelineForm.description}
                            onChange={e => setTimelineForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Additional details..."
                            rows={2}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                          <Button variant="outline" onClick={() => handleTimelineDialogChange(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSaveTimeline}
                          disabled={savingTimeline || !timelineForm.name || !timelineForm.dueDate}
                        >
                          {savingTimeline ? 'Saving...' : editingTimelineItem ? 'Save Changes' : 'Add Deadline'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingTimeline ? (
                  <p className="text-muted-foreground text-center py-8">Loading timeline...</p>
                ) : timeline.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No deadlines set yet. Click &ldquo;Add Deadline&rdquo; to create one.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timeline.map(item => (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            new Date(item.dueDate) < new Date()
                              ? 'bg-red-500/10'
                              : 'bg-blue-500/10'
                          }`}>
                            <Clock className={`h-5 w-5 ${
                              new Date(item.dueDate) < new Date()
                                ? 'text-red-500'
                                : 'text-blue-500'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {item.type.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`font-medium ${
                              new Date(item.dueDate) < new Date()
                                ? 'text-red-600'
                                : ''
                            }`}>
                              {format(new Date(item.dueDate), 'MMM d, yyyy')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(item.dueDate), 'h:mm a')}
                            </p>
                          </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleOpenEditTimeline(item)}
                            >
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteTimeline(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Events & Tests
                    </CardTitle>
                    <CardDescription>
                      View all events and manage tests for your tournament
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={() => setEventsDialogOpen(true)}
                      variant="outline"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Events
                    </Button>
                    <Button 
                      onClick={handleReleaseAllScores}
                      variant="outline"
                      disabled={!tournamentEnded}
                      title={!tournamentEnded ? 'Scores can only be released after the tournament has ended' : 'Release all scores for this tournament'}
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Release All Scores
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowAuditLogs(true)
                        if (auditLogs.length === 0) {
                          fetchAuditLogs()
                        }
                      }}
                      variant="outline"
                    >
                      <History className="h-4 w-4 mr-2" />
                      View Audit Log
                    </Button>
                    <Button onClick={fetchEventsWithTests} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                    <p>Loading events and tests...</p>
                  </div>
                ) : eventsWithTests.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No events found for this tournament.</p>
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
                      {isBCTournament && (
                        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                          <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filter by division" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Divisions</SelectItem>
                            <SelectItem value="B">Division B</SelectItem>
                            <SelectItem value="C">Division C</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Select value={eventFilter} onValueChange={setEventFilter}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                          <SelectValue placeholder="Filter by event" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Events</SelectItem>
                          {[...eventsWithTests]
                            .filter(({ event }) => event.id !== null) // Exclude trial events
                            .sort((a, b) => a.event.name.localeCompare(b.event.name))
                            .map(({ event }) => (
                              <SelectItem key={event.id} value={event.id}>
                                {event.name}
                              </SelectItem>
                            ))}
                          {[...eventsWithTests]
                            .filter(({ event }) => event.id === null) // Only trial events
                            .sort((a, b) => a.event.name.localeCompare(b.event.name))
                            .map(({ event }) => (
                              <SelectItem key={`trial-${event.name}`} value={`trial-${event.name}`}>
                                {event.name} (Trial)
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* All Events (Regular and Trial) - Sorted Alphabetically */}
                    {[...eventsWithTests]
                      .sort((a, b) => a.event.name.localeCompare(b.event.name))
                      .filter(({ event, tests }) => {
                        // Filter by division (only for B&C tournaments)
                        if (isBCTournament && divisionFilter !== 'all' && event.division !== divisionFilter) {
                          return false
                        }
                        // Filter by selected event (handle both regular and trial events)
                        if (eventFilter !== 'all') {
                          if (event.id === null) {
                            // Trial event
                            if (eventFilter !== `trial-${event.name}`) {
                              return false
                            }
                          } else {
                            // Regular event
                            if (eventFilter !== event.id) {
                              return false
                            }
                          }
                        }
                        // Show event if it has tests matching search query or no search query
                        if (!searchQuery) return true
                        return tests.some((test) =>
                          test.name.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                      })
                      .map(({ event, tests }) => {
                        const isTrialEvent = event.id === null
                        // Filter tests by search query
                        const filteredTests = tests.filter((test) => {
                          if (!searchQuery) return true
                          return test.name.toLowerCase().includes(searchQuery.toLowerCase())
                        })

                        // Skip event if showing all events and no tests match search
                        if (filteredTests.length === 0 && eventFilter === 'all' && searchQuery) {
                          return null
                        }

                        const eventKey = isTrialEvent ? `trial-${event.name}` : event.id

                        return (
                          <div key={eventKey} className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-border">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg">{event.name}</h3>
                                  {isTrialEvent && (
                                    <Badge variant="outline" className="text-xs bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400">
                                      Trial
                                    </Badge>
                                  )}
                                  {tournament.division === 'B&C' && (
                                    <Badge variant="outline" className="text-xs">
                                      Div {event.division}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''}
                                  {searchQuery && filteredTests.length !== tests.length && (
                                    <span> (filtered from {tests.length})</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReleaseEventScores(event.id, event.name)}
                                  disabled={!tournamentEnded}
                                  title={!tournamentEnded ? 'Scores can only be released after the tournament has ended' : `Release all scores for ${event.name}`}
                                >
                                  <Unlock className="h-4 w-4 mr-2" />
                                  Release All {event.name} Scores
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={() => {
                                    if (isTrialEvent) {
                                      router.push(`/td/tests/new?tournamentId=${tournament.id}&trialEventName=${encodeURIComponent(event.name)}&trialEventDivision=${event.division}`)
                                    } else {
                                      router.push(`/td/tests/new?tournamentId=${tournament.id}&eventId=${event.id}`)
                                    }
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Create Test
                                </Button>
                              </div>
                            </div>
                            
                            {filteredTests.length === 0 ? (
                              <div className="text-center py-6 bg-muted/50 rounded-lg border border-border">
                                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                                <p className="text-sm text-muted-foreground">
                                  {searchQuery 
                                    ? `No tests match "${searchQuery}" for this ${isTrialEvent ? 'trial ' : ''}event.`
                                    : `No tests created yet for this ${isTrialEvent ? 'trial ' : ''}event.`}
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
                                        <span>•</span>
                                        <span>{test.durationMinutes} minute{test.durationMinutes !== 1 ? 's' : ''}</span>
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
                                              Last edited {format(new Date(test.updatedAt), 'MMM d, yyyy')}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <TooltipProvider>
                                      <div className="flex gap-2">
                                        {test.status !== 'PUBLISHED' && (
                                          <Link href={`/td/tests/${test.id}`}>
                                            <Button variant="outline" size="sm">
                                              <Edit className="h-4 w-4 mr-1" />
                                              Edit
                                            </Button>
                                          </Link>
                                        )}
                                      {test.status === 'PUBLISHED' && (
                                        <Link href={`/td/tests/${test.id}/responses`}>
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
                                              <Link href={`/td/tests/${test.id}/settings`}>
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
                                              onClick={() => handleDeleteTestClick({ id: test.id, name: test.name })}
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
                    {[...eventsWithTests]
                      .filter(({ event, tests }) => {
                        if (eventFilter !== 'all') {
                          if (event.id === null) {
                            // Trial event
                            if (eventFilter !== `trial-${event.name}`) {
                              return false
                            }
                          } else {
                            // Regular event
                            if (eventFilter !== event.id) {
                              return false
                            }
                          }
                        }
                        if (!searchQuery) return true
                        const filteredTests = tests.filter((test) =>
                          test.name.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        return filteredTests.length > 0
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

            {/* Audit Log Dialog */}
            <Dialog open={showAuditLogs} onOpenChange={setShowAuditLogs}>
              <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Audit Log
                  </DialogTitle>
                  <DialogDescription>
                    View who created, edited, and deleted tests for this tournament
                  </DialogDescription>
                </DialogHeader>
                {/* Search and Sort Controls */}
                <div className="flex items-center gap-2 mb-4 px-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <Input
                      placeholder="Search by test name, event, or user..."
                      value={auditLogSearch}
                      onChange={(e) => setAuditLogSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="relative">
                    <Select value={auditLogSort} onValueChange={(value: 'newest' | 'oldest') => setAuditLogSort(value)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                  {loadingAuditLogs ? (
                    <div className="flex-1 flex items-center justify-center py-12">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Loading audit logs...</p>
                      </div>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-12">
                      <div className="text-center">
                        <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No audit logs found.</p>
                      </div>
                    </div>
                  ) : filteredAndSortedAuditLogs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-12">
                      <div className="text-center">
                        <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No audit logs match your search.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead>Test</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Actor</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAndSortedAuditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                <Badge 
                                  variant={
                                    log.action === 'CREATE' ? 'default' :
                                    log.action === 'UPDATE' ? 'outline' :
                                    log.action === 'DELETE' ? 'destructive' :
                                    'outline'
                                  }
                                  className={
                                    log.action === 'CREATE' ? 'bg-green-500 hover:bg-green-600 text-white dark:bg-green-600 dark:hover:bg-green-700' :
                                    log.action === 'UPDATE' ? 'bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700 border-0' :
                                    ''
                                  }
                                >
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {highlightText(log.testName, auditLogSearch)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{log.testType}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {log.eventName ? (
                                  <span className="text-sm">
                                    {highlightText(log.eventName, auditLogSearch)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex flex-col">
                                    <span className="text-sm">
                                      {highlightText(log.actorName, auditLogSearch)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {highlightText(log.actorEmail, auditLogSearch)}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                                </span>
                              </TableCell>
                              <TableCell>
                                {log.details && typeof log.details === 'object' ? (
                                  <div className="text-sm text-muted-foreground">
                                    {log.details.changes && Array.isArray(log.details.changes) ? (
                                      <span>Changed: {log.details.changes.join(', ')}</span>
                                    ) : log.details.testName ? (
                                      <span>Test: {log.details.testName}</span>
                                    ) : log.details.eventName ? (
                                      <span>Event: {log.details.eventName}</span>
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button 
                    onClick={fetchAuditLogs} 
                    variant="outline" 
                    disabled={loadingAuditLogs}
                    size="sm"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button onClick={() => setShowAuditLogs(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      Registered Teams
                    </CardTitle>
                    <CardDescription>
                      View teams registered for this tournament and contact club administrators
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {registrations.length > 0 && (
                      <Button 
                        variant="outline" 
                        onClick={handleEmailAllClubAdmins}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email All
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={fetchRegistrations}
                      disabled={loadingRegistrations}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingRegistrations ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingRegistrations ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                    <p>Loading registrations...</p>
                  </div>
                ) : registrations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No teams registered yet.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by club name or team name..."
                          value={teamsSearchQuery}
                          onChange={(e) => setTeamsSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {teamsSearchQuery && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Showing {filteredRegistrations.length} of {registrations.length} registration{registrations.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    {filteredRegistrations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No registrations found matching &ldquo;{teamsSearchQuery}&rdquo;</p>
                      </div>
                    ) : (
                      <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Club</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Division</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegistrations.map((reg) => {
                        const isExpanded = expandedRegistrations.has(reg.id)
                        const teamMembers = reg.team?.members || []
                        const memberCount = teamMembers.length
                        const hasTeam = !!reg.team
                        
                        return (
                          <>
                            <TableRow key={reg.id}>
                              <TableCell>
                                {hasTeam && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleRegistrationExpansion(reg.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {highlightText(reg.club.name, teamsSearchQuery)}
                              </TableCell>
                              <TableCell>
                                {reg.team?.name ? (
                                  highlightText(reg.team.name, teamsSearchQuery)
                                ) : (
                                  <span className="text-muted-foreground italic">Club Registration</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{formatDivision(reg.club.division)}</Badge>
                              </TableCell>
                              <TableCell>
                                {hasTeam ? (
                                  <span className="font-medium">
                                    {memberCount}/15
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  className={
                                    reg.status === 'CONFIRMED' 
                                      ? 'bg-green-500' 
                                      : reg.status === 'PENDING'
                                        ? 'bg-yellow-500'
                                        : reg.status === 'WAITLISTED'
                                          ? 'bg-blue-500'
                                          : 'bg-red-500'
                                  }
                                >
                                  {reg.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {format(new Date(reg.createdAt), 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEmailClubAdmins(reg)}
                                  className="gap-2"
                                >
                                  <Mail className="h-4 w-4" />
                                  Email Admins
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded && hasTeam && (
                              <TableRow>
                                <TableCell colSpan={8} className="bg-muted/30">
                                  <div className="py-4 px-4">
                                    <div className="mb-3">
                                      <h4 className="font-semibold mb-2">Team Members ({memberCount}/15)</h4>
                                      {memberCount === 0 ? (
                                        <p className="text-sm text-muted-foreground">No members assigned to this team.</p>
                                      ) : (
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                          {teamMembers.map((member) => (
                                            <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-background border">
                                              <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.user.image || ''} />
                                                <AvatarFallback className="text-xs">
                                                  {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">
                                                  {member.user.name || member.user.email}
                                                </p>
                                                {member.user.name && (
                                                  <p className="text-xs text-muted-foreground truncate">
                                                    {member.user.email}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )
                      })}
                    </TableBody>
                  </Table>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Read-Only Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Tournament Information
                </CardTitle>
                <CardDescription>
                  Basic tournament information (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tournament Name</Label>
                    <p className="text-base font-semibold">{tournament.name}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tournament Level</Label>
                    <p className="text-base font-semibold">{tournament.level ? tournament.level.charAt(0).toUpperCase() + tournament.level.slice(1) : <span className="text-muted-foreground italic">Not specified</span>}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Division(s)</Label>
                    <p className="text-base font-semibold">Division {formatDivision(tournament.division)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Format / Location</Label>
                    <p className="text-base font-semibold">
                      {tournament.isOnline ? 'Online' : tournament.location || 'In-Person (location TBD)'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Editable Settings Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Editable Settings
                    </CardTitle>
                    <CardDescription>
                      Configure tournament dates, fees, and registration details
                    </CardDescription>
                  </div>
                  {!isEditingSettings ? (
                    <Button onClick={() => setIsEditingSettings(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Settings
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditingSettings(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSaveSettings} 
                        disabled={savingSettings || Object.values(settingsFormErrors).some(err => err !== undefined)}
                      >
                        {savingSettings ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {savingSettings ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Tournament Date/Time */}
                <div className="border-b pb-6">
                  <h3 className="text-base font-semibold mb-5 text-foreground">Tournament Date & Time</h3>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start Date</Label>
                      {isEditingSettings ? (
                        <>
                          <Input
                            type="date"
                            value={settingsForm.startDate}
                            onChange={e => {
                              const newStartDate = e.target.value
                              setSettingsForm(prev => ({ ...prev, startDate: newStartDate }))
                              // Validate immediately
                              if (newStartDate && settingsForm.endDate) {
                                const startDateTime = newStartDate && settingsForm.startTime 
                                  ? new Date(`${newStartDate}T${settingsForm.startTime}`)
                                  : new Date(newStartDate)
                                const endDateTime = settingsForm.endDate && settingsForm.endTime
                                  ? new Date(`${settingsForm.endDate}T${settingsForm.endTime}`)
                                  : new Date(settingsForm.endDate)
                                if (endDateTime <= startDateTime) {
                                  setSettingsFormErrors(prev => ({ ...prev, endDate: 'End date/time must be after start date/time' }))
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, endDate: undefined }))
                                }
                              } else {
                                setSettingsFormErrors(prev => ({ ...prev, endDate: undefined }))
                              }
                            }}
                          />
                          {settingsFormErrors.startDate && (
                            <p className="text-sm text-destructive mt-1">{settingsFormErrors.startDate}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.startTime ? format(new Date(tournament.startTime), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start Time</Label>
                      {isEditingSettings ? (
                        <>
                          <Input
                            type="time"
                            value={settingsForm.startTime}
                            onChange={e => {
                              const newStartTime = e.target.value
                              setSettingsForm(prev => ({ ...prev, startTime: newStartTime }))
                              // Validate immediately
                              if (settingsForm.startDate && settingsForm.endDate) {
                                const startDateTime = settingsForm.startDate && newStartTime
                                  ? new Date(`${settingsForm.startDate}T${newStartTime}`)
                                  : new Date(settingsForm.startDate)
                                const endDateTime = settingsForm.endDate && settingsForm.endTime
                                  ? new Date(`${settingsForm.endDate}T${settingsForm.endTime}`)
                                  : new Date(settingsForm.endDate)
                                if (endDateTime <= startDateTime) {
                                  setSettingsFormErrors(prev => ({ ...prev, endTime: 'End date/time must be after start date/time' }))
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, endTime: undefined }))
                                }
                              } else {
                                setSettingsFormErrors(prev => ({ ...prev, endTime: undefined }))
                              }
                            }}
                          />
                          {settingsFormErrors.startTime && (
                            <p className="text-sm text-destructive mt-1">{settingsFormErrors.startTime}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.startTime ? format(new Date(tournament.startTime), 'h:mm a') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End Date</Label>
                      {isEditingSettings ? (
                        <>
                          <Input
                            type="date"
                            value={settingsForm.endDate}
                            min={settingsForm.startDate || undefined}
                            onChange={e => {
                              const newEndDate = e.target.value
                              setSettingsForm(prev => ({ ...prev, endDate: newEndDate }))
                              // Validate immediately
                              if (settingsForm.startDate && newEndDate) {
                                const startDateTime = settingsForm.startDate && settingsForm.startTime
                                  ? new Date(`${settingsForm.startDate}T${settingsForm.startTime}`)
                                  : new Date(settingsForm.startDate)
                                const endDateTime = newEndDate && settingsForm.endTime
                                  ? new Date(`${newEndDate}T${settingsForm.endTime}`)
                                  : new Date(newEndDate)
                                if (endDateTime <= startDateTime) {
                                  setSettingsFormErrors(prev => ({ ...prev, endDate: 'End date/time must be after start date/time' }))
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, endDate: undefined, endTime: undefined }))
                                }
                              } else {
                                setSettingsFormErrors(prev => ({ ...prev, endDate: undefined }))
                              }
                            }}
                          />
                          {settingsFormErrors.endDate && (
                            <p className="text-sm text-destructive mt-1">{settingsFormErrors.endDate}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.endTime ? format(new Date(tournament.endTime), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End Time</Label>
                      {isEditingSettings ? (
                        <>
                          <Input
                            type="time"
                            value={settingsForm.endTime}
                            onChange={e => {
                              const newEndTime = e.target.value
                              setSettingsForm(prev => ({ ...prev, endTime: newEndTime }))
                              // Validate immediately
                              if (settingsForm.startDate && settingsForm.endDate) {
                                const startDateTime = settingsForm.startDate && settingsForm.startTime
                                  ? new Date(`${settingsForm.startDate}T${settingsForm.startTime}`)
                                  : new Date(settingsForm.startDate)
                                const endDateTime = settingsForm.endDate && newEndTime
                                  ? new Date(`${settingsForm.endDate}T${newEndTime}`)
                                  : new Date(settingsForm.endDate)
                                if (endDateTime <= startDateTime) {
                                  setSettingsFormErrors(prev => ({ ...prev, endTime: 'End date/time must be after start date/time' }))
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, endTime: undefined }))
                                }
                              } else {
                                setSettingsFormErrors(prev => ({ ...prev, endTime: undefined }))
                              }
                            }}
                          />
                          {settingsFormErrors.endTime && (
                            <p className="text-sm text-destructive mt-1">{settingsFormErrors.endTime}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.endTime ? format(new Date(tournament.endTime), 'h:mm a') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Events Run */}
                <div className="border-b pb-6">
                  <div className="mb-5">
                    <h3 className="text-base font-semibold text-foreground">Events Run</h3>
                  </div>
                  {isEditingSettings ? (
                    <div className={`grid gap-4 ${(tournament.division === 'B' || tournament.division === 'C') ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {/* Division B Events */}
                      {(tournament.division === 'B' || tournament.division === 'B&C') && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground">Division B</h4>
                            {events.filter(e => e.division === 'B').length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSelectAllDivisionB}
                                className="h-7 text-xs"
                              >
                                {events.filter(e => e.division === 'B').every(e => settingsForm.eventsRun.includes(e.id)) ? 'Deselect All' : 'Select All'}
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1 max-h-64 overflow-y-auto border rounded-lg p-3">
                            {events.filter(e => e.division === 'B').map(event => (
                              <label 
                                key={event.id} 
                                className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                              >
                                <Checkbox
                                  checked={settingsForm.eventsRun.includes(event.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSettingsForm(prev => ({
                                        ...prev,
                                        eventsRun: [...prev.eventsRun, event.id]
                                      }))
                                    } else {
                                      setSettingsForm(prev => ({
                                        ...prev,
                                        eventsRun: prev.eventsRun.filter(id => id !== event.id)
                                      }))
                                    }
                                  }}
                                />
                                <span>{event.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Division C Events */}
                      {(tournament.division === 'C' || tournament.division === 'B&C') && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground">Division C</h4>
                            {events.filter(e => e.division === 'C').length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSelectAllDivisionC}
                                className="h-7 text-xs"
                              >
                                {events.filter(e => e.division === 'C').every(e => settingsForm.eventsRun.includes(e.id)) ? 'Deselect All' : 'Select All'}
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1 max-h-64 overflow-y-auto border rounded-lg p-3">
                            {events.filter(e => e.division === 'C').map(event => (
                              <label 
                                key={event.id} 
                                className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                              >
                                <Checkbox
                                  checked={settingsForm.eventsRun.includes(event.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSettingsForm(prev => ({
                                        ...prev,
                                        eventsRun: [...prev.eventsRun, event.id]
                                      }))
                                    } else {
                                      setSettingsForm(prev => ({
                                        ...prev,
                                        eventsRun: prev.eventsRun.filter(id => id !== event.id)
                                      }))
                                    }
                                  }}
                                />
                                <span>{event.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Trial Events */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground">Trial Events</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter trial event name..."
                              value={newTrialEvent.name}
                              onChange={(e) => setNewTrialEvent(prev => ({ ...prev, name: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTrialEvent.name.trim()) {
                                  e.preventDefault()
                                  setSettingsForm(prev => ({
                                    ...prev,
                                    trialEvents: [...prev.trialEvents, { name: newTrialEvent.name.trim(), division: newTrialEvent.division }]
                                  }))
                                  setNewTrialEvent({ name: '', division: defaultTrialEventDivision })
                                }
                              }}
                              className="flex-1"
                            />
                            {isBCTournament && (
                              <Select
                                value={newTrialEvent.division}
                                onValueChange={(value) => setNewTrialEvent(prev => ({ ...prev, division: value }))}
                              >
                                <SelectTrigger className="w-[100px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="B">Div B</SelectItem>
                                  <SelectItem value="C">Div C</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (newTrialEvent.name.trim()) {
                                  setSettingsForm(prev => ({
                                    ...prev,
                                    trialEvents: [...prev.trialEvents, { name: newTrialEvent.name.trim(), division: newTrialEvent.division }]
                                  }))
                                  setNewTrialEvent({ name: '', division: defaultTrialEventDivision })
                                }
                              }}
                              disabled={!newTrialEvent.name.trim()}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {normalizedTrialEvents.length > 0 && (
                            <div className="space-y-1 max-h-32 overflow-y-auto border rounded-lg p-3">
                              {normalizedTrialEvents.map((trialEvent, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between gap-2 text-sm p-2 rounded hover:bg-muted/50"
                                >
                                  <span className="flex items-center gap-2 flex-1 min-w-0">
                                    <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400 text-xs flex-shrink-0">
                                      Trial
                                    </Badge>
                                    <span className="truncate">{trialEvent.name}</span>
                                    <Badge variant="outline" className="text-xs flex-shrink-0">
                                      Div {trialEvent.division}
                                    </Badge>
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSettingsForm(prev => ({
                                        ...prev,
                                        trialEvents: prev.trialEvents.filter((_, i) => i !== index)
                                      }))
                                    }}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {settingsForm.eventsRun.length > 0 ? (
                          settingsForm.eventsRun.map(eventId => {
                            const event = events.find(e => e.id === eventId)
                            return event ? (
                              <Badge key={eventId} variant="secondary" className="flex items-center gap-1">
                                {event.name}
                                <span className="text-xs opacity-70">(Div {event.division})</span>
                              </Badge>
                            ) : null
                          })
                        ) : (
                          <p className="text-muted-foreground">All events</p>
                        )}
                        {normalizedTrialEvents.map((trialEvent, index) => (
                          <Badge key={`trial-${index}`} variant="outline" className="flex items-center gap-1 bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400">
                            {trialEvent.name}
                            <span className="text-xs opacity-70">(Trial, Div {trialEvent.division})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Registration Fee Structure */}
                <div className="border-b pb-6">
                  <h3 className="text-base font-semibold mb-5 text-foreground">Registration Fee Structure</h3>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fee Structure Type</Label>
                      {isEditingSettings ? (
                        <Select
                          value={settingsForm.feeStructure}
                          onValueChange={value => setSettingsForm(prev => ({ ...prev, feeStructure: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Flat Fee (same for all teams)</SelectItem>
                            <SelectItem value="tiered">Tiered (different for additional teams)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.feeStructure === 'tiered' ? 'Tiered' : 'Flat Fee'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{settingsForm.feeStructure === 'tiered' ? 'First Team Fee ($)' : 'Registration Fee ($)'}</Label>
                      {isEditingSettings ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={settingsForm.price}
                          onChange={e => setSettingsForm(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="0"
                        />
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.price === 0 ? 'Free' : `$${tournament.price}`}</p>
                      )}
                    </div>
                    {(isEditingSettings ? settingsForm.feeStructure === 'tiered' : tournament.feeStructure === 'tiered') && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional Team Fee ($)</Label>
                        {isEditingSettings ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settingsForm.additionalTeamPrice}
                            onChange={e => setSettingsForm(prev => ({ ...prev, additionalTeamPrice: e.target.value }))}
                            placeholder="e.g., 50"
                          />
                        ) : (
                          <p className="text-base font-semibold py-1.5">{tournament.additionalTeamPrice ? `$${tournament.additionalTeamPrice}` : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Registration Window */}
                <div className="border-b pb-6">
                  <h3 className="text-base font-semibold mb-5 text-foreground">Registration Window</h3>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registration Opens</Label>
                      {isEditingSettings ? (
                        <>
                          <Input
                            type="date"
                            value={settingsForm.registrationStartDate ?? undefined}
                            onChange={e => {
                              const newRegStart = e.target.value
                              setSettingsForm(prev => ({ ...prev, registrationStartDate: newRegStart }))
                              // Validate immediately
                              if (newRegStart && settingsForm.registrationEndDate) {
                                const regStart = new Date(newRegStart)
                                const regEnd = new Date(settingsForm.registrationEndDate)
                                if (regEnd <= regStart) {
                                  setSettingsFormErrors(prev => ({ ...prev, registrationEndDate: 'Registration end date must be after start date' }))
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, registrationEndDate: undefined }))
                                }
                              } else {
                                setSettingsFormErrors(prev => ({ ...prev, registrationEndDate: undefined }))
                              }
                              // Also validate late fee start date
                              if (newRegStart && settingsForm.lateFeeStartDate) {
                                const regStart = new Date(newRegStart)
                                const lateFeeStart = new Date(settingsForm.lateFeeStartDate)
                                if (lateFeeStart <= regStart) {
                                  setSettingsFormErrors(prev => ({ ...prev, lateFeeStartDate: 'Late fee start date must be after registration start date' }))
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, lateFeeStartDate: undefined }))
                                }
                              }
                            }}
                          />
                          {settingsFormErrors.registrationStartDate && (
                            <p className="text-sm text-destructive mt-1">{settingsFormErrors.registrationStartDate}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.registrationStartDate ? format(new Date(tournament.registrationStartDate), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registration Closes</Label>
                      {isEditingSettings ? (
                        <>
                          <Input
                            type="date"
                            value={settingsForm.registrationEndDate ?? undefined}
                            min={settingsForm.registrationStartDate || undefined}
                            onChange={e => {
                              const newRegEnd = e.target.value
                              setSettingsForm(prev => ({ ...prev, registrationEndDate: newRegEnd }))
                              // Validate immediately
                              if (settingsForm.registrationStartDate && newRegEnd) {
                                const regStart = new Date(settingsForm.registrationStartDate)
                                const regEnd = new Date(newRegEnd)
                                if (regEnd <= regStart) {
                                  setSettingsFormErrors(prev => ({ ...prev, registrationEndDate: 'Registration end date must be after start date' }))
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, registrationEndDate: undefined }))
                                }
                              } else {
                                setSettingsFormErrors(prev => ({ ...prev, registrationEndDate: undefined }))
                              }
                              // Also validate early bird deadline
                              if (newRegEnd && settingsForm.earlyBirdDeadline) {
                                const regEnd = new Date(newRegEnd)
                                const earlyBird = new Date(settingsForm.earlyBirdDeadline)
                                if (earlyBird >= regEnd) {
                                  setSettingsFormErrors(prev => ({ ...prev, earlyBirdDeadline: 'Early bird deadline must be before registration end date' }))
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, earlyBirdDeadline: undefined }))
                                }
                              }
                            }}
                          />
                          {settingsFormErrors.registrationEndDate && (
                            <p className="text-sm text-destructive mt-1">{settingsFormErrors.registrationEndDate}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.registrationEndDate ? format(new Date(tournament.registrationEndDate), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Discounts & Penalties */}
                <div className="border-b pb-6">
                  <h3 className="text-base font-semibold mb-5 text-foreground">Discounts & Penalties</h3>
                  <div className="space-y-6">
                    {/* Early Bird Discount */}
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Early Bird Discount ($)</Label>
                        {isEditingSettings ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settingsForm.earlyBirdDiscount}
                            onChange={e => setSettingsForm(prev => ({ ...prev, earlyBirdDiscount: e.target.value }))}
                            placeholder="e.g., 10"
                          />
                        ) : (
                          <p className="text-base font-semibold py-1.5">{tournament.earlyBirdDiscount ? `$${tournament.earlyBirdDiscount} off` : <span className="text-muted-foreground italic font-normal">None</span>}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Early Bird Deadline</Label>
                        {isEditingSettings ? (
                          <>
                            <Input
                              type="date"
                              value={settingsForm.earlyBirdDeadline ?? undefined}
                              max={settingsForm.registrationEndDate || undefined}
                              onChange={e => {
                                const newEarlyBird = e.target.value
                                setSettingsForm(prev => ({ ...prev, earlyBirdDeadline: newEarlyBird }))
                                // Validate immediately
                                if (newEarlyBird && settingsForm.registrationEndDate) {
                                  const earlyBird = new Date(newEarlyBird)
                                  const regEnd = new Date(settingsForm.registrationEndDate)
                                  if (earlyBird >= regEnd) {
                                    setSettingsFormErrors(prev => ({ ...prev, earlyBirdDeadline: 'Early bird deadline must be before registration end date' }))
                                  } else {
                                    setSettingsFormErrors(prev => ({ ...prev, earlyBirdDeadline: undefined }))
                                  }
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, earlyBirdDeadline: undefined }))
                                }
                              }}
                            />
                            {settingsFormErrors.earlyBirdDeadline && (
                              <p className="text-sm text-destructive mt-1">{settingsFormErrors.earlyBirdDeadline}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-base font-semibold py-1.5">{tournament.earlyBirdDeadline ? format(new Date(tournament.earlyBirdDeadline), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                        )}
                      </div>
                    </div>

                    {/* Late Fee */}
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Late Registration Fee ($)</Label>
                        {isEditingSettings ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settingsForm.lateFee}
                            onChange={e => setSettingsForm(prev => ({ ...prev, lateFee: e.target.value }))}
                            placeholder="e.g., 25"
                          />
                        ) : (
                          <p className="text-base font-semibold py-1.5">{tournament.lateFee ? `+$${tournament.lateFee}` : <span className="text-muted-foreground italic font-normal">None</span>}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Late Fee Starts On</Label>
                        {isEditingSettings ? (
                          <>
                            <Input
                              type="date"
                              value={settingsForm.lateFeeStartDate ?? undefined}
                              min={settingsForm.registrationStartDate || undefined}
                              onChange={e => {
                                const newLateFeeStart = e.target.value
                                setSettingsForm(prev => ({ ...prev, lateFeeStartDate: newLateFeeStart }))
                                // Validate immediately
                                if (settingsForm.registrationStartDate && newLateFeeStart) {
                                  const regStart = new Date(settingsForm.registrationStartDate)
                                  const lateFeeStart = new Date(newLateFeeStart)
                                  if (lateFeeStart <= regStart) {
                                    setSettingsFormErrors(prev => ({ ...prev, lateFeeStartDate: 'Late fee start date must be after registration start date' }))
                                  } else {
                                    setSettingsFormErrors(prev => ({ ...prev, lateFeeStartDate: undefined }))
                                  }
                                } else {
                                  setSettingsFormErrors(prev => ({ ...prev, lateFeeStartDate: undefined }))
                                }
                              }}
                            />
                            {settingsFormErrors.lateFeeStartDate && (
                              <p className="text-sm text-destructive mt-1">{settingsFormErrors.lateFeeStartDate}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-base font-semibold py-1.5">{tournament.lateFeeStartDate ? format(new Date(tournament.lateFeeStartDate), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                        )}
                      </div>
                    </div>

                    {/* Other Conditional Discounts */}
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other Conditional Discounts</Label>
                      {settingsForm.otherDiscounts.length > 0 && (
                        <div className="space-y-2">
                          {settingsForm.otherDiscounts.map((discount, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                              <span className="text-sm">
                                <span className="font-medium">{discount.condition}</span>
                                <span className="text-muted-foreground"> — </span>
                                <span className="text-green-600 font-medium">${discount.amount} off</span>
                              </span>
                              {isEditingSettings && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveOtherDiscount(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {isEditingSettings && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Condition (e.g., Host school)"
                            value={newDiscount.condition}
                            onChange={e => setNewDiscount(prev => ({ ...prev, condition: e.target.value }))}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            placeholder="Amount"
                            min="0"
                            step="1"
                            value={newDiscount.amount}
                            onChange={e => {
                              const val = e.target.value
                              if (val === '') {
                                setNewDiscount(prev => ({ ...prev, amount: '' }))
                                return
                              }
                              const num = Number(val)
                              if (Number.isNaN(num)) return
                              const clamped = Math.max(0, num)
                              setNewDiscount(prev => ({ ...prev, amount: clamped.toString() }))
                            }}
                            className="w-28 md:w-32"
                          />
                          <Button variant="outline" onClick={handleAddOtherDiscount}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {!isEditingSettings && settingsForm.otherDiscounts.length === 0 && (
                        <p className="text-muted-foreground text-sm">No additional discounts configured</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Eligibility Requirements */}
                <div>
                  <h3 className="text-base font-semibold mb-5 text-foreground">Eligibility Requirements</h3>
                  <div className="space-y-2">
                    {isEditingSettings ? (
                      <Textarea
                        value={settingsForm.eligibilityRequirements}
                        onChange={e => setSettingsForm(prev => ({ ...prev, eligibilityRequirements: e.target.value }))}
                        placeholder="Enter eligibility requirements (e.g., Must be a registered Science Olympiad team, Division B/C only, etc.)"
                        rows={4}
                      />
                    ) : (
                      <p className="text-base font-semibold whitespace-pre-wrap py-1.5">
                        {tournament.eligibilityRequirements || <span className="text-muted-foreground italic font-normal">No specific requirements</span>}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Default Test Settings Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Default Test Creation Settings
                    </CardTitle>
                    <CardDescription>
                      Configure default settings that will be applied when tests are published
                    </CardDescription>
                  </div>
                  {!isEditingDefaultTestSettings ? (
                    <Button onClick={() => setIsEditingDefaultTestSettings(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Defaults
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => {
                        setIsEditingDefaultTestSettings(false)
                        fetchDefaultTestSettings() // Reset form
                      }}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSaveDefaultTestSettings} 
                        disabled={savingDefaultTestSettings}
                      >
                        {savingDefaultTestSettings ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {savingDefaultTestSettings ? 'Saving...' : 'Save Defaults'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingDefaultTestSettings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Time Limit */}
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default Time Limit (minutes)</Label>
                        {isEditingDefaultTestSettings ? (
                          <Input
                            type="number"
                            min="1"
                            value={defaultTestSettingsForm.defaultDurationMinutes}
                            onChange={e => setDefaultTestSettingsForm(prev => ({ ...prev, defaultDurationMinutes: e.target.value }))}
                            placeholder="e.g., 60"
                          />
                        ) : (
                          <p className="text-base font-semibold py-1.5">
                            {defaultTestSettings?.defaultDurationMinutes 
                              ? `${defaultTestSettings.defaultDurationMinutes} minutes` 
                              : <span className="text-muted-foreground italic font-normal">Not set</span>}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default Max Attempts</Label>
                        {isEditingDefaultTestSettings ? (
                          <Input
                            type="number"
                            min="1"
                            value={defaultTestSettingsForm.defaultMaxAttempts}
                            onChange={e => setDefaultTestSettingsForm(prev => ({ ...prev, defaultMaxAttempts: e.target.value }))}
                            placeholder="e.g., 1"
                          />
                        ) : (
                          <p className="text-base font-semibold py-1.5">
                            {defaultTestSettings?.defaultMaxAttempts 
                              ? defaultTestSettings.defaultMaxAttempts 
                              : <span className="text-muted-foreground italic font-normal">Unlimited</span>}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Test Taking Window */}
                    <div className="border-t pt-6">
                      <h3 className="text-base font-semibold mb-4 text-foreground">Test Taking Window</h3>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default Start Date/Time</Label>
                          {isEditingDefaultTestSettings ? (
                            <Input
                              type="datetime-local"
                              value={defaultTestSettingsForm.defaultStartAt}
                              onChange={e => setDefaultTestSettingsForm(prev => ({ ...prev, defaultStartAt: e.target.value }))}
                            />
                          ) : (
                            <p className="text-base font-semibold py-1.5">
                              {defaultTestSettings?.defaultStartAt 
                                ? format(new Date(defaultTestSettings.defaultStartAt), 'MMMM d, yyyy h:mm a') 
                                : <span className="text-muted-foreground italic font-normal">Not set</span>}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default End Date/Time</Label>
                          {isEditingDefaultTestSettings ? (
                            <Input
                              type="datetime-local"
                              value={defaultTestSettingsForm.defaultEndAt}
                              min={defaultTestSettingsForm.defaultStartAt || undefined}
                              onChange={e => setDefaultTestSettingsForm(prev => ({ ...prev, defaultEndAt: e.target.value }))}
                            />
                          ) : (
                            <p className="text-base font-semibold py-1.5">
                              {defaultTestSettings?.defaultEndAt 
                                ? format(new Date(defaultTestSettings.defaultEndAt), 'MMMM d, yyyy h:mm a') 
                                : <span className="text-muted-foreground italic font-normal">Not set</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score Release */}
                    <div className="border-t pt-6">
                      <h3 className="text-base font-semibold mb-4 text-foreground">Score Release</h3>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default Release Date</Label>
                          {isEditingDefaultTestSettings ? (
                            <Input
                              type="datetime-local"
                              value={defaultTestSettingsForm.defaultReleaseScoresAt}
                              onChange={e => setDefaultTestSettingsForm(prev => ({ ...prev, defaultReleaseScoresAt: e.target.value }))}
                            />
                          ) : (
                            <p className="text-base font-semibold py-1.5">
                              {defaultTestSettings?.defaultReleaseScoresAt 
                                ? format(new Date(defaultTestSettings.defaultReleaseScoresAt), 'MMMM d, yyyy h:mm a') 
                                : <span className="text-muted-foreground italic font-normal">Not set</span>}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default Release Mode</Label>
                          {isEditingDefaultTestSettings ? (
                            <Select
                              value={defaultTestSettingsForm.defaultScoreReleaseMode}
                              onValueChange={(value: 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST') => 
                                setDefaultTestSettingsForm(prev => ({ ...prev, defaultScoreReleaseMode: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select release mode" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">None</SelectItem>
                                <SelectItem value="SCORE_ONLY">Score Only</SelectItem>
                                <SelectItem value="SCORE_WITH_WRONG">Score with Wrong Answers</SelectItem>
                                <SelectItem value="FULL_TEST">Full Test</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-base font-semibold py-1.5">
                              {defaultTestSettings?.defaultScoreReleaseMode 
                                ? defaultTestSettings.defaultScoreReleaseMode.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                                : <span className="text-muted-foreground italic font-normal">Not set</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Test Settings */}
                    <div className="border-t pt-6">
                      <h3 className="text-base font-semibold mb-4 text-foreground">Test Settings</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Require Fullscreen</Label>
                            <p className="text-sm text-muted-foreground">Force students to use fullscreen mode</p>
                          </div>
                          {isEditingDefaultTestSettings ? (
                            <Checkbox
                              checked={defaultTestSettingsForm.defaultRequireFullscreen}
                              onCheckedChange={(checked) => 
                                setDefaultTestSettingsForm(prev => ({ ...prev, defaultRequireFullscreen: checked as boolean }))
                              }
                            />
                          ) : (
                            <Badge variant={(defaultTestSettings?.defaultRequireFullscreen ?? true) ? 'default' : 'secondary'}>
                              {(defaultTestSettings?.defaultRequireFullscreen ?? true) ? 'Yes' : 'No'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Require One Sitting</Label>
                            <p className="text-sm text-muted-foreground">Students must complete test in one session</p>
                          </div>
                          {isEditingDefaultTestSettings ? (
                            <Checkbox
                              checked={defaultTestSettingsForm.defaultRequireOneSitting}
                              onCheckedChange={(checked) => 
                                setDefaultTestSettingsForm(prev => ({ ...prev, defaultRequireOneSitting: checked as boolean }))
                              }
                            />
                          ) : (
                            <Badge variant={defaultTestSettings?.defaultRequireOneSitting !== false ? 'default' : 'secondary'}>
                              {defaultTestSettings?.defaultRequireOneSitting !== false ? 'Yes' : 'No'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Allow Calculator</Label>
                            <p className="text-sm text-muted-foreground">Enable calculator for students</p>
                          </div>
                          {isEditingDefaultTestSettings ? (
                            <Checkbox
                              checked={defaultTestSettingsForm.defaultAllowCalculator}
                              onCheckedChange={(checked) => 
                                setDefaultTestSettingsForm(prev => ({ ...prev, defaultAllowCalculator: checked as boolean }))
                              }
                            />
                          ) : (
                            <Badge variant={defaultTestSettings?.defaultAllowCalculator ? 'default' : 'secondary'}>
                              {defaultTestSettings?.defaultAllowCalculator ? 'Yes' : 'No'}
                            </Badge>
                          )}
                        </div>
                        {defaultTestSettingsForm.defaultAllowCalculator && isEditingDefaultTestSettings && (
                          <div className="ml-6 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calculator Type</Label>
                            <Select
                              value={defaultTestSettingsForm.defaultCalculatorType}
                              onValueChange={(value: 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING') => 
                                setDefaultTestSettingsForm(prev => ({ ...prev, defaultCalculatorType: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select calculator type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="FOUR_FUNCTION">4-Function</SelectItem>
                                <SelectItem value="SCIENTIFIC">Scientific</SelectItem>
                                <SelectItem value="GRAPHING">Graphing</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {defaultTestSettings?.defaultAllowCalculator && !isEditingDefaultTestSettings && (
                          <div className="ml-6">
                            <p className="text-sm text-muted-foreground">
                              Type: {defaultTestSettings.defaultCalculatorType?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Not set'}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Allow Note Sheet</Label>
                            <p className="text-sm text-muted-foreground">Students can upload note sheets</p>
                          </div>
                          {isEditingDefaultTestSettings ? (
                            <Checkbox
                              checked={defaultTestSettingsForm.defaultAllowNoteSheet}
                              onCheckedChange={(checked) => 
                                setDefaultTestSettingsForm(prev => ({ ...prev, defaultAllowNoteSheet: checked as boolean }))
                              }
                            />
                          ) : (
                            <Badge variant={defaultTestSettings?.defaultAllowNoteSheet ? 'default' : 'secondary'}>
                              {defaultTestSettings?.defaultAllowNoteSheet ? 'Yes' : 'No'}
                            </Badge>
                          )}
                        </div>
                        {defaultTestSettingsForm.defaultAllowNoteSheet && isEditingDefaultTestSettings && (
                          <div className="ml-6 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label>Auto-Approve Note Sheets</Label>
                                <p className="text-sm text-muted-foreground">Automatically approve uploaded note sheets</p>
                              </div>
                              <Checkbox
                                checked={defaultTestSettingsForm.defaultAutoApproveNoteSheet}
                                onCheckedChange={(checked) => 
                                  setDefaultTestSettingsForm(prev => ({ ...prev, defaultAutoApproveNoteSheet: checked as boolean }))
                                }
                              />
                            </div>
                          </div>
                        )}
                        {defaultTestSettings?.defaultAllowNoteSheet && !isEditingDefaultTestSettings && (
                          <div className="ml-6">
                            <p className="text-sm text-muted-foreground">
                              Auto-approve: {defaultTestSettings.defaultAutoApproveNoteSheet !== false ? 'Yes' : 'No'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          </Tabs>
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

      {/* Delete Test Confirmation Dialog */}
      <Dialog open={deleteTestDialogOpen} onOpenChange={setDeleteTestDialogOpen}>
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
                setDeleteTestDialogOpen(false)
                setTestToDelete(null)
              }}
              disabled={deletingTest}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTestConfirm}
              disabled={deletingTest}
            >
              {deletingTest ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Sheet Review Dialog */}
      {noteSheetReviewOpen && (
        <NoteSheetReview
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setNoteSheetReviewOpen(null)
            }
          }}
          testId={noteSheetReviewOpen}
          testName={eventsWithTests
            .flatMap(e => e.tests)
            .find(t => t.id === noteSheetReviewOpen)?.name || 'Test'}
        />
      )}

      {/* Events Management Dialog */}
      <Dialog open={eventsDialogOpen} onOpenChange={setEventsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Events</DialogTitle>
            <DialogDescription>
              Select which events are being run in this tournament and manage trial events.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Events Run */}
            <div>
              <div className="mb-5">
                <h3 className="text-base font-semibold text-foreground">Events Run</h3>
              </div>
              <div className={`grid gap-4 ${(tournament.division === 'B' || tournament.division === 'C') ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {/* Division B Events */}
                {(tournament.division === 'B' || tournament.division === 'B&C') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Division B</h4>
                      {events.filter(e => e.division === 'B').length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAllDivisionBDialog}
                          className="h-7 text-xs"
                        >
                          {events.filter(e => e.division === 'B').every(e => eventsDialogForm.eventsRun.includes(e.id)) ? 'Deselect All' : 'Select All'}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto border rounded-lg p-3">
                      {events.filter(e => e.division === 'B').map(event => (
                        <label 
                          key={event.id} 
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                        >
                          <Checkbox
                            checked={eventsDialogForm.eventsRun.includes(event.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setEventsDialogForm(prev => ({
                                  ...prev,
                                  eventsRun: [...prev.eventsRun, event.id]
                                }))
                              } else {
                                setEventsDialogForm(prev => ({
                                  ...prev,
                                  eventsRun: prev.eventsRun.filter(id => id !== event.id)
                                }))
                              }
                            }}
                          />
                          <span>{event.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {/* Division C Events */}
                {(tournament.division === 'C' || tournament.division === 'B&C') && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Division C</h4>
                      {events.filter(e => e.division === 'C').length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAllDivisionCDialog}
                          className="h-7 text-xs"
                        >
                          {events.filter(e => e.division === 'C').every(e => eventsDialogForm.eventsRun.includes(e.id)) ? 'Deselect All' : 'Select All'}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1 max-h-64 overflow-y-auto border rounded-lg p-3">
                      {events.filter(e => e.division === 'C').map(event => (
                        <label 
                          key={event.id} 
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                        >
                          <Checkbox
                            checked={eventsDialogForm.eventsRun.includes(event.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setEventsDialogForm(prev => ({
                                  ...prev,
                                  eventsRun: [...prev.eventsRun, event.id]
                                }))
                              } else {
                                setEventsDialogForm(prev => ({
                                  ...prev,
                                  eventsRun: prev.eventsRun.filter(id => id !== event.id)
                                }))
                              }
                            }}
                          />
                          <span>{event.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {/* Trial Events */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Trial Events</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter trial event name..."
                        value={newTrialEventDialog.name}
                        onChange={(e) => setNewTrialEventDialog(prev => ({ ...prev, name: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTrialEventDialog.name.trim()) {
                            e.preventDefault()
                            setEventsDialogForm(prev => ({
                              ...prev,
                              trialEvents: [...prev.trialEvents, { name: newTrialEventDialog.name.trim(), division: newTrialEventDialog.division }]
                            }))
                            setNewTrialEventDialog({ name: '', division: defaultTrialEventDivision })
                          }
                        }}
                        className="flex-1"
                      />
                      {isBCTournament && (
                        <Select
                          value={newTrialEventDialog.division}
                          onValueChange={(value) => setNewTrialEventDialog(prev => ({ ...prev, division: value }))}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="B">Div B</SelectItem>
                            <SelectItem value="C">Div C</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newTrialEventDialog.name.trim()) {
                            setEventsDialogForm(prev => ({
                              ...prev,
                              trialEvents: [...prev.trialEvents, { name: newTrialEventDialog.name.trim(), division: newTrialEventDialog.division }]
                            }))
                            setNewTrialEventDialog({ name: '', division: defaultTrialEventDivision })
                          }
                        }}
                        disabled={!newTrialEventDialog.name.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {normalizedTrialEventsDialog.length > 0 && (
                      <div className="space-y-1 max-h-32 overflow-y-auto border rounded-lg p-3">
                        {normalizedTrialEventsDialog.map((trialEvent, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-2 text-sm p-2 rounded hover:bg-muted/50"
                          >
                            <span className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400 text-xs flex-shrink-0">
                                Trial
                              </Badge>
                              <span className="truncate">{trialEvent.name}</span>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                Div {trialEvent.division}
                              </Badge>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEventsDialogForm(prev => ({
                                  ...prev,
                                  trialEvents: prev.trialEvents.filter((_, i) => i !== index)
                                }))
                              }}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEventsDialog} disabled={savingEventsDialog}>
              {savingEventsDialog ? 'Saving...' : 'Save Changes'}
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
    </div>
  )
}

