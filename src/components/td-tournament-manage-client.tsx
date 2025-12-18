'use client'

import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatDivision } from '@/lib/utils'

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
  const router = useRouter()
  const { toast } = useToast()
  
  // Persist active tab in localStorage
  const storageKey = `td-tournament-tab-${tournament.id}`
  const [activeTab, setActiveTab] = useState<'staff' | 'timeline' | 'settings' | 'events' | 'teams'>('staff')
  const [isHydrated, setIsHydrated] = useState(false)
  
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
  })
  const [inviting, setInviting] = useState(false)

  // Staff edit dialog state
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [editStaffForm, setEditStaffForm] = useState({
    role: 'EVENT_SUPERVISOR' as 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR',
    eventIds: [] as string[],
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
  const [settingsForm, setSettingsForm] = useState({
    startDate: tournament.startDate?.split('T')[0] || '',
    endDate: tournament.endDate?.split('T')[0] || '',
    startTime: tournament.startTime?.slice(11, 16) || '',
    endTime: tournament.endTime?.slice(11, 16) || '',
    price: tournament.price?.toString() || '0',
    additionalTeamPrice: tournament.additionalTeamPrice?.toString() || '',
    feeStructure: tournament.feeStructure || 'flat',
    registrationStartDate: tournament.registrationStartDate?.split('T')[0] || '',
    registrationEndDate: tournament.registrationEndDate?.split('T')[0] || '',
    earlyBirdDiscount: tournament.earlyBirdDiscount?.toString() || '',
    earlyBirdDeadline: tournament.earlyBirdDeadline?.split('T')[0] || '',
    lateFee: tournament.lateFee?.toString() || '',
    lateFeeStartDate: tournament.lateFeeStartDate?.split('T')[0] || '',
    otherDiscounts: tournament.otherDiscounts ? JSON.parse(tournament.otherDiscounts) as OtherDiscount[] : [],
    eligibilityRequirements: tournament.eligibilityRequirements || '',
    eventsRun: tournament.eventsRun ? JSON.parse(tournament.eventsRun) as string[] : [],
  })
  const [newDiscount, setNewDiscount] = useState({ condition: '', amount: '' })
  const [hoveredTestBadge, setHoveredTestBadge] = useState<string | null>(null)

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
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  
  // Check if tournament is B&C
  const isBCTournament = tournament.division === 'B&C' || (typeof tournament.division === 'string' && tournament.division.includes('B') && tournament.division.includes('C'))
  
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
        }),
      })

      if (res.ok) {
        toast({
          title: 'Invitation sent',
          description: `An invitation has been sent to ${inviteForm.email}`,
        })
        setInviteDialogOpen(false)
        setInviteForm({ email: '', name: '', role: 'EVENT_SUPERVISOR', eventIds: [] })
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
    setEditStaffForm({
      role: member.role,
      eventIds: member.role === 'EVENT_SUPERVISOR'
        ? member.events.map(e => e.event.id)
        : [],
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
    setSavingSettings(true)
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: settingsForm.startDate ? new Date(settingsForm.startDate).toISOString() : null,
          endDate: settingsForm.endDate ? new Date(settingsForm.endDate).toISOString() : null,
          startTime: settingsForm.startDate && settingsForm.startTime 
            ? new Date(`${settingsForm.startDate}T${settingsForm.startTime}`).toISOString() 
            : null,
          endTime: settingsForm.endDate && settingsForm.endTime 
            ? new Date(`${settingsForm.endDate}T${settingsForm.endTime}`).toISOString() 
            : null,
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
        }),
      })

      if (res.ok) {
        toast({
          title: 'Settings saved',
          description: 'Tournament settings have been updated.',
        })
        setIsEditingSettings(false)
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

  // Fetch events with tests
  const fetchEventsWithTests = async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/td/tournaments/${tournament.id}/tests`)
      if (res.ok) {
        const data = await res.json()
        setEventsWithTests(data.events || [])
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch events and tests',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to fetch events with tests:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch events and tests',
        variant: 'destructive',
      })
    } finally {
      setLoadingEvents(false)
    }
  }

  // Fetch events when events tab is activated
  useEffect(() => {
    if (activeTab === 'events' && eventsWithTests.length === 0) {
      fetchEventsWithTests()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Delete test handlers
  const handleDeleteTestClick = (test: { id: string; name: string }) => {
    setTestToDelete(test)
    setDeleteTestDialogOpen(true)
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-teamy-primary dark:bg-slate-900 shadow-nav">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" href="/" variant="light" />
            <div className="h-6 w-px bg-white/20" />
            <span className="text-white font-semibold">TD Portal</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="h-8 w-8 sm:h-9 sm:w-9 ring-2 ring-white/30">
              <AvatarImage src={user.image || ''} />
              <AvatarFallback className="bg-white/20 text-white font-semibold text-sm">
                {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block max-w-[120px] md:max-w-none">
              <p className="text-xs sm:text-sm font-medium text-white truncate">
                {user.name || user.email}
              </p>
              <p className="text-[10px] sm:text-xs text-white/60 truncate">{user.email}</p>
            </div>
            <ThemeToggle variant="header" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="px-2 sm:px-3 text-white hover:bg-white/20 hover:text-white transition-colors duration-200 rounded-md"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline text-sm">Sign Out</span>
            </Button>
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
                    <DialogContent>
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
                  <p className="text-muted-foreground text-center py-8">Loading staff...</p>
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
                          setEditStaffForm(prev => ({ ...prev, role: value, eventIds: [] }))
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
                  <Button onClick={fetchEventsWithTests} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <p className="text-muted-foreground text-center py-8">Loading events and tests...</p>
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
                            .sort((a, b) => a.event.name.localeCompare(b.event.name))
                            .map(({ event }) => (
                              <SelectItem key={event.id} value={event.id}>
                                {event.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Events and Tests */}
                    {[...eventsWithTests]
                      .sort((a, b) => a.event.name.localeCompare(b.event.name))
                      .filter(({ event, tests }) => {
                        // Filter by division (only for B&C tournaments)
                        if (isBCTournament && divisionFilter !== 'all' && event.division !== divisionFilter) {
                          return false
                        }
                        // Filter by selected event
                        if (eventFilter !== 'all' && event.id !== eventFilter) {
                          return false
                        }
                        // Show event if it has tests matching search query or no search query
                        if (!searchQuery) return true
                        return tests.some((test) =>
                          test.name.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                      })
                      .map(({ event, tests }) => {
                        // Filter tests by search query
                        const filteredTests = tests.filter((test) => {
                          if (!searchQuery) return true
                          return test.name.toLowerCase().includes(searchQuery.toLowerCase())
                        })

                        // Skip event if showing all events and no tests match search
                        if (filteredTests.length === 0 && eventFilter === 'all' && searchQuery) {
                          return null
                        }

                        return (
                          <div key={event.id} className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-border">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg">{event.name}</h3>
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
                              <Button 
                                size="sm"
                                onClick={() => {
                                  router.push(`/td/tests/new?tournamentId=${tournament.id}&eventId=${event.id}`)
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Test
                              </Button>
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
                                    <div className="flex gap-2">
                                      <Link href={`/td/tests/${test.id}`}>
                                        <Button variant="outline" size="sm">
                                          <Edit className="h-4 w-4 mr-1" />
                                          Edit
                                        </Button>
                                      </Link>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleDeleteTestClick({ id: test.id, name: test.name })}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Delete
                                      </Button>
                                    </div>
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
                        if (eventFilter !== 'all' && event.id !== eventFilter) {
                          return false
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
                      <Button onClick={handleSaveSettings} disabled={savingSettings}>
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
                        <Input
                          type="date"
                          value={settingsForm.startDate}
                          onChange={e => setSettingsForm(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.startDate ? format(new Date(tournament.startDate), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start Time</Label>
                      {isEditingSettings ? (
                        <Input
                          type="time"
                          value={settingsForm.startTime}
                          onChange={e => setSettingsForm(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.startTime ? format(new Date(tournament.startTime), 'h:mm a') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End Date</Label>
                      {isEditingSettings ? (
                        <Input
                          type="date"
                          value={settingsForm.endDate}
                          onChange={e => setSettingsForm(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.endDate ? format(new Date(tournament.endDate), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End Time</Label>
                      {isEditingSettings ? (
                        <Input
                          type="time"
                          value={settingsForm.endTime}
                          onChange={e => setSettingsForm(prev => ({ ...prev, endTime: e.target.value }))}
                        />
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
                    </div>
                  ) : (
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
                        <Input
                          type="date"
                          value={settingsForm.registrationStartDate}
                          onChange={e => setSettingsForm(prev => ({ ...prev, registrationStartDate: e.target.value }))}
                        />
                      ) : (
                        <p className="text-base font-semibold py-1.5">{tournament.registrationStartDate ? format(new Date(tournament.registrationStartDate), 'MMMM d, yyyy') : <span className="text-muted-foreground italic font-normal">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registration Closes</Label>
                      {isEditingSettings ? (
                        <Input
                          type="date"
                          value={settingsForm.registrationEndDate}
                          onChange={e => setSettingsForm(prev => ({ ...prev, registrationEndDate: e.target.value }))}
                        />
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
                          <Input
                            type="date"
                            value={settingsForm.earlyBirdDeadline}
                            onChange={e => setSettingsForm(prev => ({ ...prev, earlyBirdDeadline: e.target.value }))}
                          />
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
                          <Input
                            type="date"
                            value={settingsForm.lateFeeStartDate}
                            onChange={e => setSettingsForm(prev => ({ ...prev, lateFeeStartDate: e.target.value }))}
                          />
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
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
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
    </div>
  )
}

