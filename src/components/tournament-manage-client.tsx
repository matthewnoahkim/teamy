'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppHeader } from '@/components/app-header'
import { useToast } from '@/components/ui/use-toast'
import { PageLoading } from '@/components/ui/loading-spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Users, Settings, FileText, Search, Calendar, Plus, X, Trash2, Edit, Save, Mail, Download, DollarSign, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDivision } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Tournament {
  id: string
  name: string
  division: 'B' | 'C' | 'B&C'
  description: string | null
  price: number
  paymentInstructions: string | null
  isOnline: boolean
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  location: string | null
  createdById: string
  registrations: Array<{
    id: string
    createdAt: string
    paid: boolean
    club: {
      id: string
      name: string
    }
    team: {
      id: string
      name: string
      members: Array<{
        id: string
        user: {
          id: string
          name: string | null
          email: string
        }
      }>
    } | null
    registeredBy: {
      id: string
      name: string | null
      email: string
    }
    eventSelections: Array<{
      event: {
        id: string
        name: string
      }
    }>
  }>
  admins: Array<{
    id: string
    user: {
      id: string
      name: string | null
      email: string
      image: string | null
    }
  }>
}

interface TournamentManageClientProps {
  tournamentId: string
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
}

export function TournamentManageClient({ tournamentId, user }: TournamentManageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'earliest' | 'latest'>('latest')
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null)
  const [updatingPaidStatus, setUpdatingPaidStatus] = useState<string | null>(null)
  
  // Initialize activeTab from URL param, default to 'registrations'
  const tabParam = searchParams.get('tab')
  const validTabs = ['registrations', 'admins', 'tests', 'details'] as const
  const initialTab = (tabParam && validTabs.includes(tabParam as any)) ? tabParam as typeof validTabs[number] : 'registrations'
  const [activeTab, setActiveTab] = useState<'registrations' | 'admins' | 'tests' | 'details'>(initialTab)
  
  // Edit form state
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: '',
    division: 'B' as 'B' | 'C' | 'B&C',
    description: '',
    price: '',
    paymentInstructions: '',
    isOnline: false,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    location: '',
  })
  const [saving, setSaving] = useState(false)
  const [dateTimeErrors, setDateTimeErrors] = useState<{
    startDate?: string
    endDate?: string
    startTime?: string
    endTime?: string
  }>({})
  
  // Sync activeTab with URL param when it changes (e.g., browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const validTabs = ['registrations', 'admins', 'tests', 'details'] as const
    const newTab = (tabParam && validTabs.includes(tabParam as any)) ? tabParam as typeof validTabs[number] : 'registrations'
    if (newTab !== activeTab) {
      setActiveTab(newTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  
  // Update URL when tab changes (only if it doesn't already match)
  useEffect(() => {
    const currentTabParam = searchParams.get('tab') || 'registrations'
    if (currentTabParam !== activeTab) {
      const params = new URLSearchParams(searchParams.toString())
      if (activeTab === 'registrations') {
        params.delete('tab')
      } else {
        params.set('tab', activeTab)
      }
      const newUrl = params.toString() ? `/tournaments/${tournamentId}/manage?${params.toString()}` : `/tournaments/${tournamentId}/manage`
      router.replace(newUrl, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tournamentId])
  
  // Initialize edit form when tournament loads
  useEffect(() => {
    if (tournament) {
      const startDate = new Date(tournament.startTime)
      const endDate = new Date(tournament.endTime)
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]
      const startTimeStr = startDate.toTimeString().slice(0, 5)
      const endTimeStr = endDate.toTimeString().slice(0, 5)
      
      // Preserve division value (can be 'B', 'C', or 'B&C')
      setEditFormData(prev => ({
        ...prev,
        name: tournament.name || '',
        division: (tournament.division === 'B' || tournament.division === 'C' || tournament.division === 'B&C') 
          ? tournament.division 
          : 'B',
        description: tournament.description || '',
        price: tournament.price?.toString() || '0',
        paymentInstructions: tournament.paymentInstructions || '',
        isOnline: tournament.isOnline ?? false,
        startDate: startDateStr,
        endDate: endDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        location: tournament.location || '',
      }))
    }
  }, [tournament])

  useEffect(() => {
    loadTournament()
  }, [])

  const loadTournament = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tournaments/${tournamentId}?_t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Failed to load tournament')
      
      const data = await response.json()
      
      // Server-side protection handles access control - if we reached this component,
      // the user is authorized. The API's isAdmin flag is informational only.
      setTournament(data.tournament)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load tournament',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid-pattern">
        <AppHeader user={user} />
        <PageLoading title="Loading tournament" description="Fetching tournament details..." />
      </div>
    )
  }

  if (!tournament) {
    return null
  }

  // Filter and sort registrations
  const filteredRegistrations = tournament.registrations.filter((reg) => {
    if (!searchQuery.trim()) return true
    
    const searchLower = searchQuery.toLowerCase()
    const clubName = reg.club.name.toLowerCase()
    const teamName = reg.team?.name.toLowerCase() || ''
    
    // Check member names/emails
    const memberMatches = reg.team?.members.some(member => {
      const name = (member.user.name || '').toLowerCase()
      const email = member.user.email.toLowerCase()
      return name.includes(searchLower) || email.includes(searchLower)
    }) || false
    
    // Check registeredBy name/email
    const registeredByMatches = reg.registeredBy ? (
      (reg.registeredBy.name || '').toLowerCase().includes(searchLower) ||
      reg.registeredBy.email.toLowerCase().includes(searchLower)
    ) : false
    
    // Check event names
    const eventMatches = reg.eventSelections.some(selection => 
      selection.event.name.toLowerCase().includes(searchLower)
    )
    
    return clubName.includes(searchLower) || teamName.includes(searchLower) || memberMatches || eventMatches || registeredByMatches
  })

  const sortedRegistrations = [...filteredRegistrations].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime()
    const dateB = new Date(b.createdAt).getTime()
    return sortOrder === 'earliest' ? dateA - dateB : dateB - dateA
  })

  // Helper function to highlight search terms in text (exact copy from tournaments-client)
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const handleAddAdmin = async () => {
    if (!adminEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      })
      return
    }

    try {
      setAddingAdmin(true)
      
      // Add as admin using email
      const response = await fetch(`/api/tournaments/${tournamentId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add admin')
      }

      toast({
        title: 'Success',
        description: 'Admin added successfully',
      })
      
      setAddAdminDialogOpen(false)
      setAdminEmail('')
      loadTournament()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add admin',
        variant: 'destructive',
      })
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleRemoveAdmin = async (userId: string) => {
    try {
      setRemovingAdminId(userId)
      
      const response = await fetch(`/api/tournaments/${tournamentId}/admins?userId=${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove admin')
      }

      toast({
        title: 'Success',
        description: 'Admin removed successfully',
      })
      
      loadTournament()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove admin',
        variant: 'destructive',
      })
    } finally {
      setRemovingAdminId(null)
    }
  }

  const handleEmailAll = async () => {
    try {
      // Get unique club IDs from registrations
      const clubIds = [...new Set(tournament.registrations.map(reg => reg.club.id))]
      
      // Fetch admin emails for all clubs
      const response = await fetch(`/api/tournaments/${tournamentId}/club-admins?clubIds=${clubIds.join(',')}`)
      if (!response.ok) {
        throw new Error('Failed to fetch admin emails')
      }
      
      const data = await response.json()
      const adminEmails = data.adminEmails || []
      
      if (adminEmails.length === 0) {
        toast({
          title: 'No admins found',
          description: 'No admin emails found for registered clubs',
          variant: 'destructive',
        })
        return
      }
      
      // Create mailto link with BCC
      const subject = encodeURIComponent(`Tournament Update: ${tournament.name}`)
      const body = encodeURIComponent(`Hello,\n\nThis is an update regarding the tournament: ${tournament.name}\n\nBest regards`)
      const bcc = adminEmails.join(',')
      const mailtoLink = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`
      
      window.location.href = mailtoLink
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to open email client',
        variant: 'destructive',
      })
    }
  }

  const handleTogglePaidStatus = async (registrationId: string, currentPaidStatus: boolean) => {
    try {
      setUpdatingPaidStatus(registrationId)
      
      const response = await fetch(`/api/tournaments/${tournamentId}/register/${registrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: !currentPaidStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMsg = data.error || 'Failed to update paid status'
        const details = data.details ? ` Details: ${JSON.stringify(data.details)}` : ''
        throw new Error(`${errorMsg}${details}`)
      }

      // Update local state optimistically
      setTournament((prev) => {
        if (!prev) return null
        return {
          ...prev,
          registrations: prev.registrations.map((reg) =>
            reg.id === registrationId ? { ...reg, paid: !currentPaidStatus } : reg
          ),
        }
      })

      toast({
        title: 'Success',
        description: `Payment status updated to ${!currentPaidStatus ? 'paid' : 'unpaid'}`,
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update paid status',
        variant: 'destructive',
      })
      // Reload tournament to revert optimistic update
      loadTournament()
    } finally {
      setUpdatingPaidStatus(null)
    }
  }

  const handleExportCSV = () => {
    // Helper function to escape CSV fields
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // CSV Headers
    const headers = [
      'Club Name',
      'Team Name',
      'Registration Date',
      'Paid',
      'Member Count',
      'Members',
      'Events'
    ]

    // CSV Rows
    const rows = sortedRegistrations.map((reg) => {
      const memberCount = reg.team?.members.length || 0
      const members = reg.team?.members.map(m => m.user.name || m.user.email).join('; ') || 'None'
      const events = reg.eventSelections.map(s => s.event.name).join('; ') || 'None'
      
      return [
        escapeCSV(reg.club.name),
        escapeCSV(reg.team?.name || 'N/A'),
        escapeCSV(new Date(reg.createdAt).toLocaleString()),
        escapeCSV(reg.paid ? 'Yes' : 'No'),
        escapeCSV(memberCount),
        escapeCSV(members),
        escapeCSV(events),
      ]
    })

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) => row.join(',')),
    ].join('\n')

    // Add BOM for Excel compatibility with special characters
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    link.download = `${safeName}-registrations-${new Date().toISOString().split('T')[0]}.csv`
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    toast({
      title: 'Success',
      description: 'CSV exported successfully',
    })
  }

  const handleSaveDetails = async () => {
    if (!editFormData.name?.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a tournament name',
        variant: 'destructive',
      })
      return
    }
    
    if (!editFormData.division || (editFormData.division !== 'B' && editFormData.division !== 'C' && editFormData.division !== 'B&C')) {
      toast({
        title: 'Error',
        description: 'Please select a division',
        variant: 'destructive',
      })
      return
    }
    
    if (!editFormData.startDate || !editFormData.endDate || !editFormData.startTime || !editFormData.endTime) {
      toast({
        title: 'Error',
        description: 'Please fill in all date and time fields',
        variant: 'destructive',
      })
      return
    }

    // Validate that end date/time is after start date/time
    const startDateTime = new Date(`${editFormData.startDate}T${editFormData.startTime}`)
    const endDateTime = new Date(`${editFormData.endDate}T${editFormData.endTime}`)
    if (endDateTime <= startDateTime) {
      toast({
        title: 'Error',
        description: 'End date/time must be after start date/time',
        variant: 'destructive',
      })
      setDateTimeErrors({ endDate: 'End date/time must be after start date/time', endTime: 'End date/time must be after start date/time' })
      return
    }
    
    // Clear errors if validation passes
    setDateTimeErrors({})

    try {
      setSaving(true)
      
      // Combine dates with times
      const startDateTime = new Date(`${editFormData.startDate}T${editFormData.startTime}`)
      const endDateTime = new Date(`${editFormData.endDate}T${editFormData.endTime}`)

      // Validate that end datetime is after start datetime
      if (endDateTime <= startDateTime) {
        toast({
          title: 'Error',
          description: 'End date/time must be after start date/time',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }

      // Preserve division value (can be 'B', 'C', or 'B&C')
      const response = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name,
          division: editFormData.division,
          description: editFormData.description || undefined,
          price: parseFloat(editFormData.price) || 0,
          paymentInstructions: editFormData.paymentInstructions || undefined,
          isOnline: editFormData.isOnline,
          startDate: new Date(editFormData.startDate).toISOString(),
          endDate: new Date(editFormData.endDate).toISOString(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          location: editFormData.location || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update tournament')
      }

      toast({
        title: 'Success',
        description: 'Tournament updated successfully!',
      })
      
      setIsEditing(false)
      loadTournament()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update tournament',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern">
      <AppHeader user={user} />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => router.push(`/tournaments/${tournamentId}`)} variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tournament
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl break-words">{tournament.name}</CardTitle>
            <CardDescription>Tournament Management</CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'registrations' | 'admins' | 'tests' | 'details')} className="space-y-4">
          <TabsList>
            <TabsTrigger value="registrations">
              <Users className="h-4 w-4 mr-2" />
              Registrations ({tournament.registrations.length})
            </TabsTrigger>
            <TabsTrigger value="admins">
              <Settings className="h-4 w-4 mr-2" />
              Admins ({tournament.admins.length})
            </TabsTrigger>
            <TabsTrigger value="tests">
              <FileText className="h-4 w-4 mr-2" />
              Tests
            </TabsTrigger>
            <TabsTrigger value="details">
              <Edit className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="registrations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Registered Teams</CardTitle>
                    <CardDescription>Teams that have registered for this tournament</CardDescription>
                  </div>
                  {tournament.registrations.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleEmailAll}>
                        <Mail className="h-4 w-4 mr-2" />
                        Email All
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {tournament.registrations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No teams registered yet</p>
                ) : (
                  <>
                    {/* Search and Sort Controls */}
                    <div className="space-y-4 mb-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10 shrink-0 will-change-transform" />
                          <Input
                            placeholder="Search teams, members, or events..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <div className="flex items-center gap-2 sm:w-[240px]">
                          <Label htmlFor="sort-order" className="text-sm whitespace-nowrap">Sort by:</Label>
                          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'earliest' | 'latest')}>
                            <SelectTrigger id="sort-order" className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="latest">Latest to Earliest</SelectItem>
                              <SelectItem value="earliest">Earliest to Latest</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Results */}
                    {sortedRegistrations.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        {searchQuery ? 'No teams found matching your search' : 'No teams registered yet'}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {sortedRegistrations.map((registration) => {
                          const memberCount = registration.team?.members.length || 0
                          const maxMembers = 15
                          
                          return (
                            <Card key={registration.id}>
                              <CardContent className="pt-6">
                                <div className="space-y-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold text-lg">
                                          {searchQuery ? highlightText(registration.club.name, searchQuery) : registration.club.name}
                                          {registration.team && (
                                            <>
                                              {' - '}
                                              {searchQuery ? highlightText(registration.team.name, searchQuery) : registration.team.name}
                                            </>
                                          )}
                                        </h3>
                                        {registration.paid && (
                                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                            <DollarSign className="h-3 w-3 mr-1" />
                                            Paid
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                          <Calendar className="h-4 w-4" />
                                          <span>Registered {formatDate(registration.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <Users className="h-4 w-4" />
                                          <span>
                                            {memberCount} / {maxMembers} members
                                          </span>
                                        </div>
                                        {registration.registeredBy && (
                                          <div className="flex items-center gap-1.5">
                                            <UserCheck className="h-4 w-4" />
                                            <span>
                                              Registered by:{' '}
                                              {registration.registeredBy.name ? (
                                                <>
                                                  {searchQuery ? highlightText(registration.registeredBy.name, searchQuery) : registration.registeredBy.name}
                                                  {registration.registeredBy.email && (
                                                    <span className="ml-1">
                                                      ({searchQuery ? highlightText(registration.registeredBy.email, searchQuery) : registration.registeredBy.email})
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                searchQuery ? highlightText(registration.registeredBy.email, searchQuery) : registration.registeredBy.email
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id={`paid-${registration.id}`}
                                        checked={registration.paid}
                                        onCheckedChange={() => handleTogglePaidStatus(registration.id, registration.paid)}
                                        disabled={updatingPaidStatus === registration.id}
                                      />
                                      <Label
                                        htmlFor={`paid-${registration.id}`}
                                        className="text-sm font-medium cursor-pointer flex items-center gap-2"
                                      >
                                        <DollarSign className="h-4 w-4" />
                                        <span>Paid</span>
                                      </Label>
                                    </div>
                                  </div>
                                  
                                  {registration.team && registration.team.members.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <p className="text-sm font-medium text-muted-foreground mb-2">Members:</p>
                                      <div className="space-y-1">
                                        {registration.team.members.map((member) => (
                                          <div key={member.id} className="text-sm text-foreground">
                                            {searchQuery 
                                              ? highlightText(member.user.name || member.user.email, searchQuery)
                                              : (member.user.name || member.user.email)}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {registration.eventSelections.length > 0 && (
                                    <div className="pt-2 border-t">
                                      <p className="text-sm font-medium text-muted-foreground mb-2">Events:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {registration.eventSelections.map((selection) => (
                                          <Badge key={selection.event.id} variant="secondary">
                                            {searchQuery 
                                              ? highlightText(selection.event.name, searchQuery)
                                              : selection.event.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tournament Admins</CardTitle>
                    <CardDescription>Users who can manage this tournament</CardDescription>
                  </div>
                  <Button onClick={() => setAddAdminDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Admin
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tournament.admins.map((admin) => {
                    const isCreator = tournament.createdById === admin.user.id
                    return (
                      <div key={admin.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={admin.user.image || undefined} alt={admin.user.name || admin.user.email} />
                            <AvatarFallback>
                              {(admin.user.name || admin.user.email).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{admin.user.name || admin.user.email}</p>
                            <p className="text-sm text-muted-foreground">{admin.user.email}</p>
                          </div>
                          {isCreator && (
                            <Badge variant="secondary" className="text-xs">Creator</Badge>
                          )}
                        </div>
                        {!isCreator && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAdmin(admin.user.id)}
                            disabled={removingAdminId === admin.user.id}
                            className="text-destructive hover:text-destructive"
                          >
                            {removingAdminId === admin.user.id ? (
                              'Removing...'
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tournament Tests</CardTitle>
                <CardDescription>Manage tests for this tournament</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Test management interface coming soon. You can assign tests to registered teams by event.
                </p>
                <Button className="mt-4" onClick={() => router.push(`/tournaments/${tournamentId}/tests`)}>
                  Manage Tests
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tournament Details</CardTitle>
                    <CardDescription>Edit tournament information</CardDescription>
                  </div>
                  {!isEditing ? (
                    <Button 
                      onClick={() => {
                        if (tournament) {
                          // Ensure form data is set with current tournament values before editing
                          const startDate = new Date(tournament.startTime)
                          const endDate = new Date(tournament.endTime)
                          const startDateStr = startDate.toISOString().split('T')[0]
                          const endDateStr = endDate.toISOString().split('T')[0]
                          const startTimeStr = startDate.toTimeString().slice(0, 5)
                          const endTimeStr = endDate.toTimeString().slice(0, 5)
                          
                          setEditFormData({
                            name: tournament.name || '',
                            division: (tournament.division === 'B' || tournament.division === 'C' || tournament.division === 'B&C') 
                              ? tournament.division 
                              : 'B',
                            description: tournament.description || '',
                            price: tournament.price?.toString() || '0',
                            paymentInstructions: tournament.paymentInstructions || '',
                            isOnline: tournament.isOnline ?? false,
                            startDate: startDateStr,
                            endDate: endDateStr,
                            startTime: startTimeStr,
                            endTime: endTimeStr,
                            location: tournament.location || '',
                          })
                        }
                        setIsEditing(true)
                      }} 
                      size="sm"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false)
                        }}
                        size="sm"
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSaveDetails} size="sm" disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <form className="space-y-6" onSubmit={(e) => { 
                    e.preventDefault()
                    // Check for date/time errors before submitting
                    if (Object.values(dateTimeErrors).some(err => err !== undefined)) {
                      toast({
                        title: 'Validation Error',
                        description: 'Please fix the date/time errors before saving',
                        variant: 'destructive',
                      })
                      return
                    }
                    handleSaveDetails()
                  }}>
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Tournament Name *</Label>
                      <Input
                        id="edit-name"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        placeholder="e.g., Los Altos High School Invitational"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-division">Division *</Label>
                      <Select
                        value={editFormData.division && (editFormData.division === 'B' || editFormData.division === 'C' || editFormData.division === 'B&C') ? editFormData.division : 'B'}
                        onValueChange={(value) => setEditFormData({ ...editFormData, division: value as 'B' | 'C' | 'B&C' })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="B">Division B</SelectItem>
                          <SelectItem value="C">Division C</SelectItem>
                          <SelectItem value="B&C">Division B & C</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        placeholder="Brief description of the tournament..."
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-price">Registration Fee ($) *</Label>
                      <Input
                        id="edit-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editFormData.price}
                        onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-paymentInstructions">Payment Instructions</Label>
                      <Textarea
                        id="edit-paymentInstructions"
                        value={editFormData.paymentInstructions}
                        onChange={(e) => setEditFormData({ ...editFormData, paymentInstructions: e.target.value })}
                        placeholder="e.g., Send payment via Venmo to @tournament-name or mail check to..."
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-location">Location</Label>
                      <Input
                        id="edit-location"
                        value={editFormData.location}
                        onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                        placeholder="e.g., Los Altos High School"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-isOnline"
                        checked={editFormData.isOnline}
                        onCheckedChange={(checked) => setEditFormData({ ...editFormData, isOnline: checked === true })}
                      />
                      <Label htmlFor="edit-isOnline" className="text-sm font-normal cursor-pointer">
                        This is an online tournament
                      </Label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-startDate">Start Date *</Label>
                        <Input
                          id="edit-startDate"
                          type="date"
                          value={editFormData.startDate}
                          onChange={(e) => {
                            const newStartDate = e.target.value
                            setEditFormData({ ...editFormData, startDate: newStartDate })
                            // Validate immediately
                            if (newStartDate && editFormData.endDate && editFormData.startTime && editFormData.endTime) {
                              const startDateTime = new Date(`${newStartDate}T${editFormData.startTime}`)
                              const endDateTime = new Date(`${editFormData.endDate}T${editFormData.endTime}`)
                              if (endDateTime <= startDateTime) {
                                setDateTimeErrors(prev => ({ ...prev, endDate: 'End date/time must be after start date/time', endTime: 'End date/time must be after start date/time' }))
                              } else {
                                setDateTimeErrors(prev => ({ ...prev, endDate: undefined, endTime: undefined }))
                              }
                            } else {
                              setDateTimeErrors(prev => ({ ...prev, endDate: undefined, endTime: undefined }))
                            }
                          }}
                          required
                        />
                        {dateTimeErrors.startDate && (
                          <p className="text-sm text-destructive mt-1">{dateTimeErrors.startDate}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-endDate">End Date *</Label>
                        <Input
                          id="edit-endDate"
                          type="date"
                          value={editFormData.endDate}
                          min={editFormData.startDate || undefined}
                          onChange={(e) => {
                            const newEndDate = e.target.value
                            setEditFormData({ ...editFormData, endDate: newEndDate })
                            // Validate immediately
                            if (editFormData.startDate && newEndDate && editFormData.startTime && editFormData.endTime) {
                              const startDateTime = new Date(`${editFormData.startDate}T${editFormData.startTime}`)
                              const endDateTime = new Date(`${newEndDate}T${editFormData.endTime}`)
                              if (endDateTime <= startDateTime) {
                                setDateTimeErrors(prev => ({ ...prev, endDate: 'End date/time must be after start date/time', endTime: 'End date/time must be after start date/time' }))
                              } else {
                                setDateTimeErrors(prev => ({ ...prev, endDate: undefined, endTime: undefined }))
                              }
                            } else {
                              setDateTimeErrors(prev => ({ ...prev, endDate: undefined, endTime: undefined }))
                            }
                          }}
                          required
                        />
                        {dateTimeErrors.endDate && (
                          <p className="text-sm text-destructive mt-1">{dateTimeErrors.endDate}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-startTime">Start Time *</Label>
                        <Input
                          id="edit-startTime"
                          type="time"
                          value={editFormData.startTime}
                          onChange={(e) => {
                            const newStartTime = e.target.value
                            setEditFormData({ ...editFormData, startTime: newStartTime })
                            // Validate immediately
                            if (editFormData.startDate && editFormData.endDate && newStartTime && editFormData.endTime) {
                              const startDateTime = new Date(`${editFormData.startDate}T${newStartTime}`)
                              const endDateTime = new Date(`${editFormData.endDate}T${editFormData.endTime}`)
                              if (endDateTime <= startDateTime) {
                                setDateTimeErrors(prev => ({ ...prev, endTime: 'End date/time must be after start date/time' }))
                              } else {
                                setDateTimeErrors(prev => ({ ...prev, endTime: undefined }))
                              }
                            } else {
                              setDateTimeErrors(prev => ({ ...prev, endTime: undefined }))
                            }
                          }}
                          required
                        />
                        {dateTimeErrors.startTime && (
                          <p className="text-sm text-destructive mt-1">{dateTimeErrors.startTime}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-endTime">End Time *</Label>
                        <Input
                          id="edit-endTime"
                          type="time"
                          value={editFormData.endTime}
                          onChange={(e) => {
                            const newEndTime = e.target.value
                            setEditFormData({ ...editFormData, endTime: newEndTime })
                            // Validate immediately
                            if (editFormData.startDate && editFormData.endDate && editFormData.startTime && newEndTime) {
                              const startDateTime = new Date(`${editFormData.startDate}T${editFormData.startTime}`)
                              const endDateTime = new Date(`${editFormData.endDate}T${newEndTime}`)
                              if (endDateTime <= startDateTime) {
                                setDateTimeErrors(prev => ({ ...prev, endTime: 'End date/time must be after start date/time' }))
                              } else {
                                setDateTimeErrors(prev => ({ ...prev, endTime: undefined }))
                              }
                            } else {
                              setDateTimeErrors(prev => ({ ...prev, endTime: undefined }))
                            }
                          }}
                          required
                        />
                        {dateTimeErrors.endTime && (
                          <p className="text-sm text-destructive mt-1">{dateTimeErrors.endTime}</p>
                        )}
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Tournament Name</Label>
                      <p className="font-medium">{tournament.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Division</Label>
                      <p className="font-medium">Division {formatDivision(tournament.division)}</p>
                    </div>
                    {tournament.description && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Description</Label>
                        <p className="font-medium break-words whitespace-pre-wrap">{tournament.description}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm text-muted-foreground">Registration Fee</Label>
                      <p className="font-medium">
                        {tournament.price === 0 ? 'Free' : `$${tournament.price.toFixed(2)}`}
                      </p>
                    </div>
                    {tournament.paymentInstructions && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Payment Instructions</Label>
                        <p className="font-medium whitespace-pre-wrap">{tournament.paymentInstructions}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm text-muted-foreground">Location</Label>
                      <p className="font-medium">
                        {tournament.isOnline ? 'Online Tournament' : (tournament.location || 'Not specified')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Start Date/Time</Label>
                      <p className="font-medium">
                        {new Date(tournament.startTime).toLocaleString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">End Date/Time</Label>
                      <p className="font-medium">
                        {new Date(tournament.endTime).toLocaleString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Admin Dialog */}
        <Dialog open={addAdminDialogOpen} onOpenChange={setAddAdminDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tournament Admin</DialogTitle>
              <DialogDescription>
                Enter the email address of the user you want to add as an admin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email Address</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="user@example.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddAdmin()
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddAdminDialogOpen(false)
                  setAdminEmail('')
                }}
                disabled={addingAdmin}
              >
                Cancel
              </Button>
              <Button onClick={handleAddAdmin} disabled={addingAdmin || !adminEmail.trim()}>
                {addingAdmin ? 'Adding...' : 'Add Admin'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

