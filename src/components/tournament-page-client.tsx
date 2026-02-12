'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from 'next-auth/react'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import { Pencil, LogOut, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { 
  Edit, 
  Save, 
  X, 
  Trophy, 
  MapPin, 
  Calendar,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  DollarSign,
  Users,
  Globe,
  Building,
  CalendarCheck,
  Tag,
  FileText,
  CheckCircle2,
  ClipboardCheck,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { format, isBefore, isAfter } from 'date-fns'
import { formatDivision, divisionsMatch as _divisionsMatch } from '@/lib/utils'

interface TournamentHostingRequest {
  id: string
  tournamentName: string
  tournamentLevel: string
  division: string
  tournamentFormat: string
  location: string | null
  preferredSlug: string | null
  directorName: string
  directorEmail: string
  directorPhone: string | null
  otherNotes: string | null
  status: string
  reviewNotes: string | null
  createdAt: string | Date
}

interface Tournament {
  id: string
  name: string
  slug: string | null
  division: 'B' | 'C' | 'B&C' | string
  description: string | null
  isOnline: boolean
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  location: string | null
  price: number
  additionalTeamPrice: number | null
  feeStructure: string
  registrationStartDate: string | null
  registrationEndDate: string | null
  earlyBirdDiscount: number | null
  earlyBirdDeadline: string | null
  lateFee: number | null
  lateFeeStartDate: string | null
  eligibilityRequirements: string | null
  eventsRun: string | null
  trialEvents: string | null
}

interface Section {
  id: string
  type: 'header' | 'text' | 'image' | 'html'
  title: string
  content: string
}

interface UserClub {
  id: string
  name: string
  division: string
  teams: { id: string; name: string }[]
}

interface TournamentPageClientProps {
  hostingRequest: TournamentHostingRequest
  tournament: Tournament | null
  isDirector: boolean
  isTournamentAdmin?: boolean
  user?: {
    id: string
    name?: string | null
    email: string
  }
  userClubs?: UserClub[]
  initialSections?: Section[]
  isRegistered?: boolean
  hasAvailableTests?: boolean
  initialEventsNotRun?: Array<{ id: string; name: string; division: string }>
}

export function TournamentPageClient({ 
  hostingRequest, 
  tournament, 
  isDirector, 
  isTournamentAdmin = false, 
  user, 
  userClubs = [],
  initialSections,
  isRegistered: initialIsRegistered = false,
  hasAvailableTests: initialHasAvailableTests = false,
  initialEventsNotRun = [],
}: TournamentPageClientProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user?.name ?? null)
  const defaultSections: Section[] = [
    {
      id: '1',
      type: 'header',
      title: 'About',
      content: `Welcome to ${hostingRequest.tournamentName}! This is a ${hostingRequest.tournamentLevel} Science Olympiad tournament for Division ${formatDivision(hostingRequest.division)}.`
    }
  ]
  const [sections, setSections] = useState<Section[]>(initialSections || defaultSections)
  const [saving, setSaving] = useState(false)
  
  // Registration state
  const [_registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [selectedClub, setSelectedClub] = useState<string>('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [_registering, setRegistering] = useState(false)

  // Events not being run - use initial data from server (always provided now)
  const [eventsNotRun, setEventsNotRun] = useState<Array<{ id: string; name: string; division: string }>>(initialEventsNotRun)
  const [eventsNotRunLoading, setEventsNotRunLoading] = useState(false)

  // Check if user is registered and tests are available (use initial values from server)
  const [isRegistered, _setIsRegistered] = useState(initialIsRegistered)
  const [hasAvailableTests, _setHasAvailableTests] = useState(initialHasAvailableTests)

  // Update events not run if tournament data changes (fallback for client-side updates)
  useEffect(() => {
    // Only refetch if tournament changes and we need to recalculate
    // In most cases, initialEventsNotRun from server will be used
    if (!tournament || initialEventsNotRun.length > 0) {
      return
    }

    // This is a fallback - should rarely be needed since server always provides initial data
    const fetchEventsNotRun = async () => {
      setEventsNotRunLoading(true)

      try {
        // Determine which divisions to fetch events for
        const divisions: ('B' | 'C')[] = []
        if (tournament.division === 'B' || tournament.division === 'B&C') {
          divisions.push('B')
        }
        if (tournament.division === 'C' || tournament.division === 'B&C') {
          divisions.push('C')
        }

        if (divisions.length === 0) {
          setEventsNotRun([])
          setEventsNotRunLoading(false)
          return
        }

        // Fetch events for all relevant divisions
        const allEvents: Array<{ id: string; name: string; division: string }> = []
        for (const division of divisions) {
          const response = await fetch(`/api/events?division=${division}`)
          if (response.ok) {
            const data = await response.json()
            if (data.events) {
              allEvents.push(...data.events)
            }
          }
        }

        // Parse eventsRun - if null/empty, assume all events are being run
        let eventsRunIds: string[] = []
        if (tournament.eventsRun && tournament.eventsRun.trim()) {
          try {
            const parsed = JSON.parse(tournament.eventsRun)
            eventsRunIds = Array.isArray(parsed) ? parsed : []
          } catch (e) {
            console.error('Error parsing eventsRun:', e)
          }
        }

        // If eventsRun is empty, all events are being run, so nothing to show
        if (eventsRunIds.length === 0) {
          setEventsNotRun([])
          setEventsNotRunLoading(false)
          return
        }

        // Find events that are NOT in eventsRun
        const notRun = allEvents.filter(event => !eventsRunIds.includes(event.id))
        setEventsNotRun(notRun.sort((a, b) => a.name.localeCompare(b.name)))
      } catch (error) {
        console.error('Error fetching events:', error)
        setEventsNotRun([])
      } finally {
        setEventsNotRunLoading(false)
      }
    }

    fetchEventsNotRun()
  }, [tournament?.id, tournament?.division, tournament?.eventsRun, initialEventsNotRun])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/tournament-pages/${hostingRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageContent: JSON.stringify(sections) })
      })

      if (!response.ok) throw new Error('Failed to save')

      toast({
        title: 'Saved!',
        description: 'Your tournament page has been updated.',
      })
      setIsEditing(false)
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to save tournament page.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const addSection = (type: Section['type']) => {
    const newSection: Section = {
      id: Date.now().toString(),
      type,
      title: type === 'header' ? 'New Section' : '',
      content: type === 'text' ? 'Enter your content here...' : ''
    }
    setSections([...sections, newSection])
  }

  const updateSection = (id: string, updates: Partial<Section>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const deleteSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id))
  }

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const index = sections.findIndex(s => s.id === id)
    if (direction === 'up' && index > 0) {
      const newSections = [...sections]
      ;[newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]]
      setSections(newSections)
    } else if (direction === 'down' && index < sections.length - 1) {
      const newSections = [...sections]
      ;[newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]]
      setSections(newSections)
    }
  }

  // Registration helpers
  const now = new Date()
  const registrationOpen = tournament?.registrationStartDate 
    ? isAfter(now, new Date(tournament.registrationStartDate)) 
    : true
  const registrationClosed = tournament?.registrationEndDate 
    ? isAfter(now, new Date(tournament.registrationEndDate)) 
    : false
  const canRegister = registrationOpen && !registrationClosed && tournament

  const isEarlyBird = tournament?.earlyBirdDeadline 
    ? isBefore(now, new Date(tournament.earlyBirdDeadline)) 
    : false
  const isLateFee = tournament?.lateFeeStartDate 
    ? isAfter(now, new Date(tournament.lateFeeStartDate)) 
    : false

  const _calculatePrice = (teamCount: number) => {
    if (!tournament) return 0
    let basePrice = 0
    
    if (tournament.feeStructure === 'tiered' && tournament.additionalTeamPrice !== null) {
      basePrice = tournament.price + (teamCount > 1 ? (teamCount - 1) * tournament.additionalTeamPrice : 0)
    } else {
      basePrice = tournament.price * teamCount
    }

    if (isEarlyBird && tournament.earlyBirdDiscount) {
      basePrice -= tournament.earlyBirdDiscount * teamCount
    }
    if (isLateFee && tournament.lateFee) {
      basePrice += tournament.lateFee * teamCount
    }

    return Math.max(0, basePrice)
  }

  const selectedClubData = userClubs.find(c => c.id === selectedClub)
  const _eligibleTeams = selectedClubData?.teams || []

  const _handleRegister = async () => {
    if (!tournament || !selectedClub || selectedTeams.length === 0) return

    setRegistering(true)
    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: selectedClub,
          teamIds: selectedTeams,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to register')
      }

      toast({
        title: 'Registration Submitted!',
        description: `Successfully registered ${selectedTeams.length} team${selectedTeams.length > 1 ? 's' : ''} for this tournament.`,
      })
      setRegisterDialogOpen(false)
      setSelectedClub('')
      setSelectedTeams([])
    } catch (error) {
      toast({
        title: 'Registration Failed',
        description: error instanceof Error ? error.message : 'Failed to register for tournament',
        variant: 'destructive',
      })
    } finally {
      setRegistering(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Sign out error', error)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground grid-pattern flex flex-col">
      {/* Header */}
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 sm:gap-3 outline-none">
                    <Avatar 
                      className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer ring-2 ring-white/30 hover:ring-white/50 transition-all"
                    >
                      <AvatarImage src={undefined} />
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
            ) : (
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/tournaments/${hostingRequest.preferredSlug || tournament?.slug || tournament?.id || hostingRequest.id}`)}`} className="hidden md:block">
                <button className="px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors whitespace-nowrap shadow-sm">
                  Sign In
                </button>
              </Link>
            )}
            {isDirector && !isEditing && (
              <Button 
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="sm"
                className="gap-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Edit className="h-4 w-4" />
                Edit Page
              </Button>
            )}
            {isDirector && isEditing && (
              <>
                <Button 
                  onClick={handleSave}
                  size="sm"
                  className="gap-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  disabled={saving}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button 
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-white/80 hover:text-white hover:bg-white/10 border-white/20 hover:border-white/40 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      
      <EditUsernameDialog
        open={editUsernameOpen}
        onOpenChange={setEditUsernameOpen}
        currentName={currentUserName}
        onNameUpdated={setCurrentUserName}
      />

      {/* Tournament Hero */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="flex justify-center gap-2 mb-4">
            <Badge variant="outline" className="text-sm">
              {hostingRequest.tournamentLevel.charAt(0).toUpperCase() + hostingRequest.tournamentLevel.slice(1)}
            </Badge>
            <Badge variant="outline" className="text-sm">Division {formatDivision(hostingRequest.division)}</Badge>
            <Badge variant="outline" className="text-sm">
              {hostingRequest.tournamentFormat === 'satellite' ? 'Online' : 'In-Person'}
            </Badge>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold">{hostingRequest.tournamentName}</h1>
          {tournament && (
            <div className="flex flex-wrap justify-center gap-4 text-muted-foreground mt-4">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(tournament.startDate), 'MMMM d, yyyy')}
                {tournament.startDate !== tournament.endDate && (
                  <> - {format(new Date(tournament.endDate), 'MMMM d, yyyy')}</>
                )}
              </span>
              {tournament.location && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {tournament.location}
                </span>
              )}
            </div>
          )}
          
          {/* Action Buttons */}
          {tournament && (
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Link href={`/tournaments/${tournament.slug || tournament.id}/register`}>
                <Button size="lg" className="gap-2">
                  <Trophy className="h-5 w-5" />
                  {canRegister ? 'Register Now' : 'View Registration'}
                </Button>
              </Link>
              {isRegistered && hasAvailableTests && (
                <Link href={`/testing?tournamentId=${tournament.id}`}>
                  <Button size="lg" className="gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Take Tests
                  </Button>
                </Link>
              )}
              {isTournamentAdmin && (
                <Link href={`/td/manage/${hostingRequest.id}`}>
                  <Button size="lg" className="gap-2">
                    <Settings className="h-5 w-5" />
                    Manage Tournament
                  </Button>
                </Link>
              )}
            </div>
          )}

        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-5xl flex-1">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Tournament Details Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Info Card */}
            {tournament && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Tournament Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Date & Time */}
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Date & Time</p>
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          const startDateTime = new Date(tournament.startTime)
                          const endDateTime = new Date(tournament.endTime)
                          const startDateOnly = new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate())
                          const endDateOnly = new Date(endDateTime.getFullYear(), endDateTime.getMonth(), endDateTime.getDate())
                          const sameDay = startDateOnly.getTime() === endDateOnly.getTime()
                          
                          if (sameDay) {
                            return (
                              <>
                                {format(startDateTime, 'MMM d, h:mm a')} – {format(endDateTime, 'h:mm a')}
                              </>
                            )
                          } else {
                            return (
                              <>
                                {format(startDateTime, 'MMM d, h:mm a')} – {format(endDateTime, 'MMM d, h:mm a')}
                              </>
                            )
                          }
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-3">
                    {tournament.isOnline ? (
                      <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                    ) : (
                      <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium">{tournament.isOnline ? 'Online Tournament' : 'Location'}</p>
                      <p className="text-sm text-muted-foreground">
                        {tournament.isOnline ? 'Virtual / Remote' : tournament.location || 'TBA'}
                      </p>
                    </div>
                  </div>

                  {/* Division */}
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Division</p>
                      <p className="text-sm text-muted-foreground">Division {formatDivision(tournament.division)}</p>
                    </div>
                  </div>

                  {/* Events Not Offered */}
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">Events Not Offered</p>
                      <div className="mt-2">
                        {eventsNotRunLoading ? (
                          <p className="text-sm text-muted-foreground">Loading...</p>
                        ) : eventsNotRun.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {eventsNotRun.map((event) => {
                              const showDivision = tournament.division === 'B&C'
                              return (
                                <Badge key={event.id} variant="outline" className="text-xs">
                                  {showDivision ? (
                                    <span>
                                      {event.name}
                                      <span className="text-muted-foreground">
                                        {' '}(Div {event.division})
                                      </span>
                                    </span>
                                  ) : (
                                    event.name
                                  )}
                                </Badge>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            All events are being run
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trial Events */}
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium">Trial Events</p>
                      <div className="mt-2">
                        {(() => {
                          try {
                            if (!tournament.trialEvents || !tournament.trialEvents.trim()) {
                              return <p className="text-sm text-muted-foreground">None</p>
                            }
                            
                            const trialEvents = JSON.parse(tournament.trialEvents) as Array<{ name: string; division: string } | string>
                            const normalizedTrialEvents = trialEvents.map(event => {
                              if (typeof event === 'string') {
                                return { name: event, division: 'B' }
                              }
                              return event
                            })
                            
                            if (normalizedTrialEvents.length === 0) {
                              return <p className="text-sm text-muted-foreground">None</p>
                            }
                            
                            // Sort trial events alphabetically by name, with Division B before Division C for same names
                            const sortedTrialEvents = [...normalizedTrialEvents].sort((a, b) => {
                              const nameCompare = a.name.localeCompare(b.name)
                              if (nameCompare !== 0) {
                                return nameCompare
                              }
                              // If names are the same, Division B comes before Division C
                              if (a.division === 'B' && b.division === 'C') {
                                return -1
                              }
                              if (a.division === 'C' && b.division === 'B') {
                                return 1
                              }
                              return 0
                            })
                            
                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {sortedTrialEvents.map((trialEvent, index) => {
                                  const showDivision = tournament.division === 'B&C'
                                  return (
                                    <Badge 
                                      key={index} 
                                      variant="outline" 
                                      className="text-xs bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400"
                                    >
                                      {showDivision ? (
                                        <span>
                                          {trialEvent.name}
                                          <span className="text-muted-foreground">
                                            {' '}(Trial, Div {trialEvent.division})
                                          </span>
                                        </span>
                                      ) : (
                                        <span>
                                          {trialEvent.name}
                                          <span className="text-muted-foreground">
                                            {' '}(Trial)
                                          </span>
                                        </span>
                                      )}
                                    </Badge>
                                  )
                                })}
                              </div>
                            )
                          } catch (e) {
                            console.error('Error parsing trial events:', e)
                            return <p className="text-sm text-muted-foreground">None</p>
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Registration Info Card */}
            {tournament && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Registration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Fee */}
                  <div className="flex items-start gap-3">
                    <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Registration Fee</p>
                      <p className="text-sm text-muted-foreground">
                        {tournament.price === 0 ? 'Free' : (
                          tournament.feeStructure === 'tiered' && tournament.additionalTeamPrice !== null ? (
                            <>
                              ${tournament.price} (first team), ${tournament.additionalTeamPrice} (additional)
                            </>
                          ) : (
                            <>${tournament.price} per team</>
                          )
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Registration Window */}
                  {(tournament.registrationStartDate || tournament.registrationEndDate) && (
                    <div className="flex items-start gap-3">
                      <CalendarCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">Registration Window</p>
                        <p className="text-sm text-muted-foreground">
                          {tournament.registrationStartDate && (
                            <>Opens: {format(new Date(tournament.registrationStartDate), 'MMM d, yyyy')}</>
                          )}
                          {tournament.registrationStartDate && tournament.registrationEndDate && <br />}
                          {tournament.registrationEndDate && (
                            <>Closes: {format(new Date(tournament.registrationEndDate), 'MMM d, yyyy')}</>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Early Bird */}
                  {tournament.earlyBirdDiscount && tournament.earlyBirdDeadline && (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-600">Early Bird Discount</p>
                        <p className="text-sm text-muted-foreground">
                          Save ${tournament.earlyBirdDiscount} per team
                          <br />
                          Until {format(new Date(tournament.earlyBirdDeadline), 'MMM d, yyyy')}
                        </p>
                        {isEarlyBird && (
                          <Badge variant="outline" className="mt-1 text-green-600 border-green-600">
                            Active Now!
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Late Fee */}
                  {tournament.lateFee && tournament.lateFeeStartDate && (
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-600">Late Fee</p>
                        <p className="text-sm text-muted-foreground">
                          +${tournament.lateFee} per team
                          <br />
                          After {format(new Date(tournament.lateFeeStartDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Eligibility Requirements */}
            {tournament?.eligibilityRequirements && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Eligibility
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {tournament.eligibilityRequirements}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{hostingRequest.directorName}</p>
                <p className="text-sm text-muted-foreground">{hostingRequest.directorEmail}</p>
                {hostingRequest.directorPhone && (
                  <p className="text-sm text-muted-foreground">{hostingRequest.directorPhone}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* Edit Mode Toolbar */}
            {isEditing && (
              <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-lg">Add Section</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => addSection('header')} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Header
                  </Button>
                  <Button size="sm" onClick={() => addSection('text')} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Text
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Sections */}
            <div className="space-y-6">
              {sections.map((section, index) => (
                <Card key={section.id} className={isEditing ? 'border-2 border-dashed' : ''}>
                  <CardContent className="p-6">
                    {isEditing && (
                      <div className="flex items-center justify-between mb-4 pb-4 border-b">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">{section.type}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => moveSection(section.id, 'up')}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => moveSection(section.id, 'down')}
                            disabled={index === sections.length - 1}
                          >
                            ↓
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => deleteSection(section.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="space-y-4">
                        {section.type === 'header' && (
                          <div className="space-y-2">
                            <Label>Section Title</Label>
                            <Input
                              value={section.title}
                              onChange={(e) => updateSection(section.id, { title: e.target.value })}
                              placeholder="Section title"
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Content</Label>
                          <Textarea
                            value={section.content}
                            onChange={(e) => updateSection(section.id, { content: e.target.value })}
                            placeholder="Enter content..."
                            rows={section.type === 'header' ? 3 : 6}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        {section.type === 'header' && section.title && (
                          <h2 className="text-2xl font-bold mb-4">{section.title}</h2>
                        )}
                        <div className="prose dark:prose-invert max-w-none">
                          <p className="whitespace-pre-wrap">{section.content}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Default empty state */}
            {sections.length === 0 && !isEditing && (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <p>No content has been added to this tournament page yet.</p>
                  {isDirector && (
                    <p className="mt-2">Click &quot;Edit Page&quot; to get started!</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4 mt-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
              
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
