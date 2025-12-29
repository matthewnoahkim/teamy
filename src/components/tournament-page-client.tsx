'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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
import { formatDivision, divisionsMatch } from '@/lib/utils'

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
}: TournamentPageClientProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
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
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [selectedClub, setSelectedClub] = useState<string>('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [registering, setRegistering] = useState(false)

  // Events not being run
  const [eventsNotRun, setEventsNotRun] = useState<Array<{ id: string; name: string; division: string }>>([])
  const [eventsNotRunLoading, setEventsNotRunLoading] = useState(true)

  // Check if user is registered and tests are available (use initial values from server)
  const [isRegistered, setIsRegistered] = useState(initialIsRegistered)
  const [hasAvailableTests, setHasAvailableTests] = useState(initialHasAvailableTests)

  // Fetch events and calculate which are not being run
  useEffect(() => {
    const fetchEventsNotRun = async () => {
      if (!tournament) {
        setEventsNotRunLoading(false)
        return
      }

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
  }, [tournament?.id, tournament?.division, tournament?.eventsRun])

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
    } catch (error) {
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

  const calculatePrice = (teamCount: number) => {
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
  const eligibleTeams = selectedClubData?.teams || []

  const handleRegister = async () => {
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

  return (
    <div className="min-h-screen bg-background text-foreground grid-pattern flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-teamy-primary dark:bg-slate-900 shadow-nav">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-4">
            <ThemeToggle variant="header" />
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
            {user ? (
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/tournaments/${hostingRequest.preferredSlug || tournament?.slug || tournament?.id || hostingRequest.id}`)}`}>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Tournament Hero */}
      <section className="bg-gradient-to-b from-teamy-primary/10 to-transparent py-12 px-4">
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
                      <p className="font-medium">Date</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(tournament.startDate), 'EEEE, MMMM d, yyyy')}
                        {tournament.startDate !== tournament.endDate && (
                          <> - {format(new Date(tournament.endDate), 'MMMM d, yyyy')}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Time</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(tournament.startTime), 'h:mm a')} - {format(new Date(tournament.endTime), 'h:mm a')}
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
                  {tournament.trialEvents && (() => {
                    try {
                      const trialEvents = JSON.parse(tournament.trialEvents) as Array<{ name: string; division: string } | string>
                      const normalizedTrialEvents = trialEvents.map(event => {
                        if (typeof event === 'string') {
                          return { name: event, division: 'B' }
                        }
                        return event
                      })
                      
                      if (normalizedTrialEvents.length > 0) {
                        return (
                          <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">Trial Events</p>
                              <div className="mt-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {normalizedTrialEvents.map((trialEvent, index) => {
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
                              </div>
                            </div>
                          </div>
                        )
                      }
                    } catch (e) {
                      console.error('Error parsing trial events:', e)
                    }
                    return null
                  })()}
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
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
