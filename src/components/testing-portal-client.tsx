'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { useToast } from '@/components/ui/use-toast'
import { PageLoading } from '@/components/ui/loading-spinner'
import { Calendar, MapPin, Trophy, FileText, ChevronRight, LogOut, Pencil, ChevronDown, Clock, HelpCircle, ListChecks, AlertCircle, Calculator, FileCheck, Play, ArrowRight, Upload, CheckCircle2, XCircle } from 'lucide-react'
import { formatDivision } from '@/lib/utils'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { isTestAvailable } from '@/lib/test-availability'
import { NoteSheetUpload } from '@/components/tests/note-sheet-upload'

interface Tournament {
  tournament: {
    id: string
    name: string
    division: string
    startDate: string
    endDate: string
    location: string | null
    slug: string | null
  }
  registration: {
    id: string
    team: {
      id: string
      name: string
    } | null
    club: {
      id: string
      name: string
    }
  }
  events: Array<{
    event: {
      id: string
      name: string
      slug: string
      division: string
    }
    tests: Array<{
      id: string
      name: string
      description: string | null
      instructions: string | null
      durationMinutes: number
      startAt: string | null
      endAt: string | null
      allowLateUntil: string | null
      requireFullscreen: boolean
      allowCalculator: boolean
      calculatorType: string | null
      allowNoteSheet: boolean
      noteSheetInstructions: string | null
      maxAttempts: number | null
      scoreReleaseMode: string | null
      releaseScoresAt: string | null
      questionCount: number
      clubId: string
      club: {
        id: string
        name: string
      }
    }>
  }>
  generalTests: Array<{
    id: string
    name: string
    description: string | null
    instructions: string | null
    durationMinutes: number
    startAt: string | null
    endAt: string | null
    allowLateUntil: string | null
    requireFullscreen: boolean
    allowCalculator: boolean
    calculatorType: string | null
    allowNoteSheet: boolean
    noteSheetInstructions: string | null
    maxAttempts: number | null
    scoreReleaseMode: string | null
    releaseScoresAt: string | null
    questionCount: number
    clubId: string
    club: {
      id: string
      name: string
    }
  }>
}

interface TestingPortalClientProps {
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
}

const STORAGE_KEY = 'testing-portal-selected-tournament'

export function TestingPortalClient({ user }: TestingPortalClientProps) {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null)
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user.name ?? null)
  // Track note sheet status for each test: Map<testId, { status: string | null, hasNoteSheet: boolean }>
  const [noteSheetStatuses, setNoteSheetStatuses] = useState<Map<string, { status: string | null, hasNoteSheet: boolean, rejectionReason: string | null }>>(new Map())
  const [noteSheetUploadOpen, setNoteSheetUploadOpen] = useState<string | null>(null)

  // Load tournaments
  useEffect(() => {
    loadTournaments()
  }, [])

  // Restore selected tournament from URL query param or localStorage after tournaments are loaded (only once)
  useEffect(() => {
    if (!loading && tournaments.length > 0 && selectedTournament === null) {
      // First check URL query parameter
      const tournamentIdFromUrl = searchParams.get('tournamentId')
      if (tournamentIdFromUrl) {
        // Verify the tournament exists in the list
        const tournamentExists = tournaments.some(t => t.tournament.id === tournamentIdFromUrl)
        if (tournamentExists) {
          setSelectedTournament(tournamentIdFromUrl)
          localStorage.setItem(STORAGE_KEY, tournamentIdFromUrl)
          return
        }
      }
      
      // Fallback to localStorage
      const savedTournamentId = localStorage.getItem(STORAGE_KEY)
      if (savedTournamentId) {
        // Verify the tournament still exists in the list
        const tournamentExists = tournaments.some(t => t.tournament.id === savedTournamentId)
        if (tournamentExists) {
          setSelectedTournament(savedTournamentId)
        } else {
          // Tournament no longer exists, clear it from storage
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, tournaments, searchParams])

  // Save selected tournament to localStorage whenever user changes selection
  const handleSetSelectedTournament = (tournamentId: string | null) => {
    setSelectedTournament(tournamentId)
    if (tournamentId) {
      localStorage.setItem(STORAGE_KEY, tournamentId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const loadTournaments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/testing/tournaments')
      if (!response.ok) throw new Error('Failed to load tournaments')
      
      const data = await response.json()
      setTournaments(data.tournaments || [])
      
      // Load note sheet statuses for all tests that allow note sheets
      await loadNoteSheetStatuses(data.tournaments || [])
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load tournaments',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadNoteSheetStatuses = async (tournaments: Tournament[]) => {
    const statusMap = new Map<string, { status: string | null, hasNoteSheet: boolean, rejectionReason: string | null }>()
    
    // Collect all test IDs that allow note sheets
    const testIds: string[] = []
    tournaments.forEach(tournament => {
      tournament.events.forEach(event => {
        event.tests.forEach(test => {
          if (test.allowNoteSheet) {
            testIds.push(test.id)
          }
        })
      })
      tournament.generalTests.forEach(test => {
        if (test.allowNoteSheet) {
          testIds.push(test.id)
        }
      })
    })

    // Fetch note sheet status for each test
    const promises = testIds.map(async (testId) => {
      try {
        const response = await fetch(`/api/tests/${testId}/note-sheets`)
        if (response.ok) {
          const data = await response.json()
          if (data.noteSheet) {
            statusMap.set(testId, {
              status: data.noteSheet.status,
              hasNoteSheet: true,
              rejectionReason: data.noteSheet.rejectionReason || null,
            })
          } else {
            statusMap.set(testId, {
              status: null,
              hasNoteSheet: false,
              rejectionReason: null,
            })
          }
        } else {
          statusMap.set(testId, {
            status: null,
            hasNoteSheet: false,
            rejectionReason: null,
          })
        }
      } catch (error) {
        // Silently fail for individual tests
        statusMap.set(testId, {
          status: null,
          hasNoteSheet: false,
          rejectionReason: null,
        })
      }
    })

    await Promise.all(promises)
    setNoteSheetStatuses(statusMap)
  }

  const handleNoteSheetUploadSuccess = () => {
    // Reload note sheet statuses after successful upload
    if (selectedTournament) {
      const tournament = tournaments.find(t => t.tournament.id === selectedTournament)
      if (tournament) {
        loadNoteSheetStatuses([tournament])
      }
    }
  }

  const selectedTournamentData = selectedTournament
    ? tournaments.find((t) => t.tournament.id === selectedTournament)
    : null

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy')
    } catch {
      return dateString
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a')
    } catch {
      return dateString
    }
  }

  const formatDateRange = (start: string, end: string) => {
    try {
      const startDate = new Date(start)
      const endDate = new Date(end)
      // If same day, show start date/time and end time
      if (startDate.toDateString() === endDate.toDateString()) {
        const dateStr = format(new Date(start), 'MMM d, yyyy')
        const startTime = format(new Date(start), 'h:mm a')
        const endTime = format(new Date(end), 'h:mm a')
        return `${dateStr} ${startTime} - ${endTime}`
      }
      // Different days, show full date/time for both
      return `${formatDateTime(start)} - ${formatDateTime(end)}`
    } catch {
      return `${start} - ${end}`
    }
  }

  const formatTestTimeRange = (startAt: string | null | undefined, endAt: string | null | undefined, allowLateUntil: string | null | undefined) => {
    // Check if dates exist and are not empty strings
    if (!startAt || !endAt || startAt.trim() === '' || endAt.trim() === '') {
      return null
    }
    try {
      // Handle both string and Date serialization (in case it comes as ISO string or Date object)
      const startDate = new Date(startAt)
      const endDate = new Date(endAt)
      const deadlineDate = allowLateUntil ? new Date(allowLateUntil) : endDate
      
      // Check if dates are valid
      if (isNaN(startDate.getTime()) || isNaN(deadlineDate.getTime())) {
        console.warn('Invalid dates in formatTestTimeRange:', { startAt, endAt, allowLateUntil })
        return null
      }
      
      // If same day, show start date/time and deadline time
      if (startDate.toDateString() === deadlineDate.toDateString()) {
        const dateStr = format(startDate, 'MMM d, yyyy')
        const startTime = format(startDate, 'h:mm a')
        const deadlineTime = format(deadlineDate, 'h:mm a')
        return `${dateStr} ${startTime} - ${deadlineTime}`
      }
      // Different days, show full date/time for both
      return `${formatDateTime(startAt)} - ${formatDateTime(allowLateUntil || endAt)}`
    } catch (error) {
      console.error('Error formatting test time range:', error, { startAt, endAt, allowLateUntil })
      return null
    }
  }

  const checkTestAvailability = (test: {
    startAt: string | null
    endAt: string | null
    allowLateUntil: string | null
  }) => {
    // Convert string dates to Date objects for isTestAvailable
    const startAt = test.startAt ? new Date(test.startAt) : null
    const endAt = test.endAt ? new Date(test.endAt) : null
    const allowLateUntil = test.allowLateUntil ? new Date(test.allowLateUntil) : null

    // Use the isTestAvailable function - tests are always PUBLISHED when shown in this portal
    return isTestAvailable({
      status: 'PUBLISHED',
      startAt,
      endAt,
      allowLateUntil,
    })
  }

  const handleTakeTest = (testId: string, clubId: string, isESTest?: boolean) => {
    // Use the new universal testing portal route for tournament tests
    window.location.href = `/testing/tests/${testId}/take`
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/testing' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern flex flex-col">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-teamy-primary dark:bg-slate-900 shadow-nav">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="md" href="/" variant="light" />
              <div className="h-6 w-px bg-white/20" />
              <span className="text-white font-semibold">Testing Portal</span>
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
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle variant="header" />
            </div>
          </div>
        </header>
        <PageLoading title="Loading tournaments" description="Fetching your tournament registrations..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-teamy-primary dark:bg-slate-900 shadow-nav">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" href="/" variant="light" />
            <div className="h-6 w-px bg-white/20" />
            <span className="text-white font-semibold">Testing Portal</span>
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
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl flex-1">
        {selectedTournamentData ? (
          // Tournament detail view
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => handleSetSelectedTournament(null)}
                className="gap-2"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back to Tournaments
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{selectedTournamentData.tournament.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge variant="outline">Division {formatDivision(selectedTournamentData.tournament.division)}</Badge>
                  {selectedTournamentData.tournament.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {selectedTournamentData.tournament.location}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDateRange(
                      selectedTournamentData.tournament.startDate,
                      selectedTournamentData.tournament.endDate
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Team: {selectedTournamentData.registration.team?.name || selectedTournamentData.registration.club.name}
                </p>
              </div>

              {/* Events with tests */}
              {selectedTournamentData.events.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold">Your Events</h2>
                  {selectedTournamentData.events.map((eventData) => (
                    <Card key={eventData.event.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="h-5 w-5" />
                          {eventData.event.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {eventData.tests.filter((test) => {
                          // Filter out tests that are outside their availability window
                          const availability = checkTestAvailability(test)
                          return availability.available
                        }).length > 0 ? (
                          <div className="space-y-3">
                            {eventData.tests.filter((test) => {
                              // Filter out tests that are outside their availability window
                              const availability = checkTestAvailability(test)
                              return availability.available
                            }).map((test) => (
                              <Card key={test.id} className="bg-slate-50 dark:bg-slate-800 hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                  <div className="space-y-4">
                                    {/* Header */}
                                    <div>
                                      <h3 className="text-lg font-semibold mb-1">{test.name}</h3>
                                      {test.description && (
                                        <p className="text-sm text-muted-foreground">{test.description}</p>
                                      )}
                                    </div>
                                    
                                    {/* Test Details - Theme Aligned */}
                                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                        {/* Duration */}
                                        <div className="flex items-center gap-3">
                                          <div className="p-2 bg-teamy-primary/10 rounded-lg">
                                            <Clock className="h-4 w-4 text-teamy-primary" />
                                          </div>
                                          <div>
                                            <div className="text-xs text-muted-foreground">Duration</div>
                                            <div className="text-sm font-semibold">{test.durationMinutes} min</div>
                                          </div>
                                        </div>
                                        
                                        {/* Questions */}
                                        {test.questionCount > 0 && (
                                          <div className="flex items-center gap-3">
                                            <div className="p-2 bg-teamy-primary/10 rounded-lg">
                                              <ListChecks className="h-4 w-4 text-teamy-primary" />
                                            </div>
                                            <div>
                                              <div className="text-xs text-muted-foreground">Questions</div>
                                              <div className="text-sm font-semibold">{test.questionCount}</div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Calculator */}
                                        <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-lg ${test.allowCalculator ? 'bg-teamy-accent/20' : 'bg-muted'}`}>
                                            <Calculator className={`h-4 w-4 ${test.allowCalculator ? 'text-teamy-accent-dark' : 'text-muted-foreground'}`} />
                                          </div>
                                          <div>
                                            <div className="text-xs text-muted-foreground">Calculator</div>
                                            <div className="text-sm font-semibold">
                                              {test.allowCalculator ? (
                                                <span className="text-teamy-primary">
                                                  {test.calculatorType 
                                                    ? (test.calculatorType === 'FOUR_FUNCTION' ? 'Four Function' : 
                                                       test.calculatorType === 'SCIENTIFIC' ? 'Scientific' : 
                                                       'Graphing')
                                                    : 'Allowed'}
                                                </span>
                                              ) : (
                                                <span className="text-muted-foreground">Not Allowed</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Note Sheet */}
                                        <div className="flex items-center gap-3">
                                          <div className={`p-2 rounded-lg ${test.allowNoteSheet ? 'bg-teamy-accent/20' : 'bg-muted'}`}>
                                            <FileCheck className={`h-4 w-4 ${test.allowNoteSheet ? 'text-teamy-accent-dark' : 'text-muted-foreground'}`} />
                                          </div>
                                          <div>
                                            <div className="text-xs text-muted-foreground">Note Sheet</div>
                                            <div className="text-sm font-semibold">
                                              {test.allowNoteSheet ? (
                                                <span className="text-teamy-primary">Allowed</span>
                                              ) : (
                                                <span className="text-muted-foreground">Not Allowed</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Max Attempts */}
                                        {test.maxAttempts && (
                                          <div className="flex items-center gap-3">
                                            <div className="p-2 bg-teamy-primary/10 rounded-lg">
                                              <AlertCircle className="h-4 w-4 text-teamy-primary" />
                                            </div>
                                            <div>
                                              <div className="text-xs text-muted-foreground">Max Attempts</div>
                                              <div className="text-sm font-semibold">{test.maxAttempts}</div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Availability */}
                                      <div className="mt-4 pt-4 border-t border-border">
                                        <div className="flex items-center gap-3">
                                          <div className="p-2 bg-teamy-primary/10 rounded-lg">
                                            <Calendar className="h-4 w-4 text-teamy-primary" />
                                          </div>
                                          <div className="flex-1">
                                            <div className="text-xs text-muted-foreground mb-1">Availability</div>
                                            <div className="text-sm font-semibold">
                                              {(() => {
                                                // Check if dates exist and are valid
                                                const hasStartAt = test.startAt && test.startAt.trim && test.startAt.trim() !== ''
                                                const hasEndAt = test.endAt && test.endAt.trim && test.endAt.trim() !== ''
                                                
                                                if (hasStartAt && hasEndAt) {
                                                  const formatted = formatTestTimeRange(test.startAt, test.endAt, test.allowLateUntil)
                                                  if (formatted) {
                                                    return formatted
                                                  }
                                                  // Fallback if formatTestTimeRange returns null
                                                  try {
                                                    if (!test.startAt || !test.endAt) {
                                                      return <span className="text-muted-foreground">Invalid date range</span>
                                                    }
                                                    const startFormatted = formatDateTime(test.startAt)
                                                    const endFormatted = formatDateTime(test.endAt)
                                                    if (startFormatted && endFormatted) {
                                                      return `${startFormatted} - ${endFormatted}`
                                                    }
                                                    return <span className="text-muted-foreground">Invalid date range</span>
                                                  } catch {
                                                    return <span className="text-muted-foreground">Invalid date range</span>
                                                  }
                                                }
                                                return <span className="text-teamy-primary">Always available</span>
                                              })()}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Note sheet instructions if available */}
                                    {test.allowNoteSheet && test.noteSheetInstructions && (
                                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-start gap-2">
                                          <FileCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                          <div>
                                            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Note Sheet Guidelines</div>
                                            <p className="text-sm text-blue-900 dark:text-blue-100">{test.noteSheetInstructions}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Note Sheet Status and Upload */}
                                    {test.allowNoteSheet && (() => {
                                      const noteSheetStatus = noteSheetStatuses.get(test.id)
                                      const isAccepted = noteSheetStatus?.status === 'ACCEPTED'
                                      return (
                                        <div className={`${isAccepted ? 'bg-green-500/20 dark:bg-green-600/20' : 'bg-amber-50 dark:bg-amber-950/20'} rounded-md p-4 border ${isAccepted ? 'border-green-500 dark:border-green-600' : 'border-amber-200 dark:border-amber-800'}`}>
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 flex-1">
                                              <FileText className={`h-5 w-5 ${isAccepted ? 'text-black dark:text-white' : 'text-amber-600 dark:text-amber-400'} flex-shrink-0 mt-0.5`} />
                                              <div className="flex-1">
                                                {(() => {
                                                  if (!noteSheetStatus || !noteSheetStatus.hasNoteSheet) {
                                                    return (
                                                      <>
                                                        <div className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                                                          You haven&apos;t uploaded a note sheet yet
                                                        </div>
                                                        <div className="text-sm text-amber-800 dark:text-amber-200">
                                                          Upload one before the test starts.
                                                        </div>
                                                      </>
                                                    )
                                                  } else if (noteSheetStatus.status === 'ACCEPTED') {
                                                    return (
                                                      <>
                                                        <div className="text-sm font-semibold text-black dark:text-white mb-1">
                                                          Note Sheet Accepted
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-black dark:text-white">
                                                          <CheckCircle2 className="h-4 w-4" />
                                                          <span>Your note sheet has been accepted</span>
                                                        </div>
                                                      </>
                                                    )
                                                  } else if (noteSheetStatus.status === 'PENDING') {
                                                    return (
                                                      <>
                                                        <div className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                                                          Note Sheet Pending Review
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                                                          <Clock className="h-4 w-4" />
                                                          <span>Your note sheet is pending review</span>
                                                        </div>
                                                      </>
                                                    )
                                                  } else if (noteSheetStatus.status === 'REJECTED') {
                                                    return (
                                                      <>
                                                        <div className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                                                          Note Sheet Rejected
                                                        </div>
                                                        <div className="space-y-2">
                                                          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                                                            <XCircle className="h-4 w-4" />
                                                            <span>Your note sheet was rejected. Please upload a new one.</span>
                                                          </div>
                                                          {noteSheetStatus.rejectionReason && noteSheetStatus.rejectionReason.trim() && (
                                                            <div className="mt-2 p-3 bg-white dark:bg-red-950/40 rounded border-2 border-red-300 dark:border-red-700">
                                                              <p className="text-xs font-semibold text-red-900 dark:text-red-100 mb-1.5 uppercase tracking-wide">
                                                                Admin Comments:
                                                              </p>
                                                              <p className="text-sm text-red-900 dark:text-red-100 whitespace-pre-wrap leading-relaxed">
                                                                {noteSheetStatus.rejectionReason}
                                                              </p>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </>
                                                    )
                                                  }
                                                  return null
                                                })()}
                                              </div>
                                            </div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setNoteSheetUploadOpen(test.id)}
                                              className="flex-shrink-0"
                                            >
                                              {noteSheetStatuses.get(test.id)?.hasNoteSheet ? (
                                                <>
                                                  <Upload className="h-4 w-4 mr-2" />
                                                  Modify
                                                </>
                                              ) : (
                                                <>
                                                  <Upload className="h-4 w-4 mr-2" />
                                                  Upload
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {/* Instructions if available */}
                                    {test.instructions && (
                                      <div className="bg-slate-100 dark:bg-slate-900/50 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-start gap-2">
                                          <HelpCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                          <div>
                                            <div className="text-xs font-semibold text-muted-foreground mb-1">Instructions</div>
                                            <p className="text-sm whitespace-pre-wrap">{test.instructions}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Badges and Action Button */}
                                    <div className="flex items-center justify-between gap-4 pt-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {test.requireFullscreen && (
                                          <Badge variant="outline" className="text-xs">
                                            Fullscreen Required
                                          </Badge>
                                        )}
                                        {test.scoreReleaseMode && (
                                          <Badge variant="outline" className="text-xs">
                                            {test.scoreReleaseMode === 'FULL_TEST' ? 'Full Review' :
                                             test.scoreReleaseMode === 'SCORE_WITH_WRONG' ? 'Score + Wrong' :
                                             test.scoreReleaseMode === 'SCORE_ONLY' ? 'Score Only' :
                                             'No Review'}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      {(() => {
                                        const availability = checkTestAvailability(test)
                                        return (
                                          <div className="flex flex-col items-end gap-2">
                                            {!availability.available && availability.reason && (
                                              <span className="text-xs text-muted-foreground">{availability.reason}</span>
                                            )}
                                            <Button
                                              onClick={() => handleTakeTest(test.id, test.clubId)}
                                              size="lg"
                                              disabled={!availability.available}
                                              className="bg-teamy-primary hover:bg-teamy-primary/90 text-white shadow-lg hover:shadow-xl transition-all duration-200 gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              <Play className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                                              Take Test
                                              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No tests released for this event yet.</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* General tests (not assigned to a specific event) */}
              {selectedTournamentData.generalTests.filter((test) => {
                // Filter out tests that are outside their availability window
                const availability = checkTestAvailability(test)
                return availability.available
              }).length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold">General Tests</h2>
                  <div className="space-y-3">
                    {selectedTournamentData.generalTests.filter((test) => {
                      // Filter out tests that are outside their availability window
                      const availability = checkTestAvailability(test)
                      return availability.available
                    }).map((test) => (
                      <Card key={test.id} className="bg-slate-50 dark:bg-slate-800 hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            {/* Header */}
                            <div>
                              <h3 className="text-lg font-semibold mb-1">{test.name}</h3>
                              {test.description && (
                                <p className="text-sm text-muted-foreground">{test.description}</p>
                              )}
                            </div>
                            
                            {/* Test Details - Theme Aligned */}
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {/* Duration */}
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-teamy-primary/10 rounded-lg">
                                    <Clock className="h-4 w-4 text-teamy-primary" />
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground">Duration</div>
                                    <div className="text-sm font-semibold">{test.durationMinutes} min</div>
                                  </div>
                                </div>
                                
                                {/* Questions */}
                                {test.questionCount > 0 && (
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-teamy-primary/10 rounded-lg">
                                      <ListChecks className="h-4 w-4 text-teamy-primary" />
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground">Questions</div>
                                      <div className="text-sm font-semibold">{test.questionCount}</div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Calculator */}
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${test.allowCalculator ? 'bg-teamy-accent/20' : 'bg-muted'}`}>
                                    <Calculator className={`h-4 w-4 ${test.allowCalculator ? 'text-teamy-accent-dark' : 'text-muted-foreground'}`} />
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground">Calculator</div>
                                    <div className="text-sm font-semibold">
                                      {test.allowCalculator ? (
                                        <span className="text-teamy-primary">
                                          {test.calculatorType 
                                            ? (test.calculatorType === 'FOUR_FUNCTION' ? 'Four Function' : 
                                               test.calculatorType === 'SCIENTIFIC' ? 'Scientific' : 
                                               'Graphing')
                                            : 'Allowed'}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">Not Allowed</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Note Sheet */}
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${test.allowNoteSheet ? 'bg-teamy-accent/20' : 'bg-muted'}`}>
                                    <FileCheck className={`h-4 w-4 ${test.allowNoteSheet ? 'text-teamy-accent-dark' : 'text-muted-foreground'}`} />
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground">Note Sheet</div>
                                    <div className="text-sm font-semibold">
                                      {test.allowNoteSheet ? (
                                        <span className="text-teamy-primary">Allowed</span>
                                      ) : (
                                        <span className="text-muted-foreground">Not Allowed</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Max Attempts */}
                                {test.maxAttempts && (
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-teamy-primary/10 rounded-lg">
                                      <AlertCircle className="h-4 w-4 text-teamy-primary" />
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground">Max Attempts</div>
                                      <div className="text-sm font-semibold">{test.maxAttempts}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Availability */}
                              <div className="mt-4 pt-4 border-t border-border">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-teamy-primary/10 rounded-lg">
                                    <Calendar className="h-4 w-4 text-teamy-primary" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs text-muted-foreground mb-1">Availability</div>
                                    <div className="text-sm font-semibold">
                                      {(() => {
                                        // Check if dates exist and are valid
                                        const hasStartAt = test.startAt && test.startAt.trim && test.startAt.trim() !== ''
                                        const hasEndAt = test.endAt && test.endAt.trim && test.endAt.trim() !== ''
                                        
                                        if (hasStartAt && hasEndAt) {
                                          const formatted = formatTestTimeRange(test.startAt, test.endAt, test.allowLateUntil)
                                          if (formatted) {
                                            return formatted
                                          }
                                          // Fallback if formatTestTimeRange returns null
                                          try {
                                            if (!test.startAt || !test.endAt) {
                                              return <span className="text-muted-foreground">Invalid date range</span>
                                            }
                                            const startFormatted = formatDateTime(test.startAt)
                                            const endFormatted = formatDateTime(test.endAt)
                                            if (startFormatted && endFormatted) {
                                              return `${startFormatted} - ${endFormatted}`
                                            }
                                            return <span className="text-muted-foreground">Invalid date range</span>
                                          } catch {
                                            return <span className="text-muted-foreground">Invalid date range</span>
                                          }
                                        }
                                        return <span className="text-teamy-primary">Always available</span>
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Note sheet instructions if available */}
                            {test.allowNoteSheet && test.noteSheetInstructions && (
                              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-start gap-2">
                                  <FileCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Note Sheet Guidelines</div>
                                    <p className="text-sm text-blue-900 dark:text-blue-100">{test.noteSheetInstructions}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Note Sheet Status and Upload */}
                            {test.allowNoteSheet && (() => {
                              const noteSheetStatus = noteSheetStatuses.get(test.id)
                              const isAccepted = noteSheetStatus?.status === 'ACCEPTED'
                              return (
                                <div className={`${isAccepted ? 'bg-green-500/20 dark:bg-green-600/20' : 'bg-amber-50 dark:bg-amber-950/20'} rounded-md p-4 border ${isAccepted ? 'border-green-500 dark:border-green-600' : 'border-amber-200 dark:border-amber-800'}`}>
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                      <FileText className={`h-5 w-5 ${isAccepted ? 'text-black dark:text-white' : 'text-amber-600 dark:text-amber-400'} flex-shrink-0 mt-0.5`} />
                                      <div className="flex-1">
                                        {(() => {
                                          if (!noteSheetStatus || !noteSheetStatus.hasNoteSheet) {
                                            return (
                                              <>
                                                <div className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                                                  You haven&apos;t uploaded a note sheet yet
                                                </div>
                                                <div className="text-sm text-amber-800 dark:text-amber-200">
                                                  Upload one before the test starts.
                                                </div>
                                              </>
                                            )
                                          } else if (noteSheetStatus.status === 'ACCEPTED') {
                                            return (
                                              <>
                                                <div className="text-sm font-semibold text-black dark:text-white mb-1">
                                                  Note Sheet Accepted
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-black dark:text-white">
                                                  <CheckCircle2 className="h-4 w-4" />
                                                  <span>Your note sheet has been accepted</span>
                                                </div>
                                              </>
                                            )
                                          } else if (noteSheetStatus.status === 'PENDING') {
                                            return (
                                              <>
                                                <div className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                                                  Note Sheet Pending Review
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                                                  <Clock className="h-4 w-4" />
                                                  <span>Your note sheet is pending review</span>
                                                </div>
                                              </>
                                            )
                                          } else if (noteSheetStatus.status === 'REJECTED') {
                                            return (
                                              <>
                                                <div className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                                                  Note Sheet Rejected
                                                </div>
                                                <div className="space-y-2">
                                                  <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                                                    <XCircle className="h-4 w-4" />
                                                    <span>Your note sheet was rejected. Please upload a new one.</span>
                                                  </div>
                                                  {noteSheetStatus.rejectionReason && noteSheetStatus.rejectionReason.trim() && (
                                                    <div className="mt-2 p-3 bg-white dark:bg-red-950/40 rounded border-2 border-red-300 dark:border-red-700">
                                                      <p className="text-xs font-semibold text-red-900 dark:text-red-100 mb-1.5 uppercase tracking-wide">
                                                        Admin Comments:
                                                      </p>
                                                      <p className="text-sm text-red-900 dark:text-red-100 whitespace-pre-wrap leading-relaxed">
                                                        {noteSheetStatus.rejectionReason}
                                                      </p>
                                                    </div>
                                                  )}
                                                </div>
                                              </>
                                            )
                                          }
                                          return null
                                        })()}
                                      </div>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setNoteSheetUploadOpen(test.id)}
                                      className="flex-shrink-0"
                                    >
                                      {noteSheetStatuses.get(test.id)?.hasNoteSheet ? (
                                        <>
                                          <Upload className="h-4 w-4 mr-2" />
                                          Modify
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="h-4 w-4 mr-2" />
                                          Upload
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              )
                            })()}

                            {/* Instructions if available */}
                            {test.instructions && (
                              <div className="bg-slate-100 dark:bg-slate-900/50 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                                <div className="flex items-start gap-2">
                                  <HelpCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground mb-1">Instructions</div>
                                    <p className="text-sm whitespace-pre-wrap">{test.instructions}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Badges and Action Button */}
                            <div className="flex items-center justify-between gap-4 pt-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {test.requireFullscreen && (
                                  <Badge variant="outline" className="text-xs">
                                    Fullscreen Required
                                  </Badge>
                                )}
                                {test.scoreReleaseMode && (
                                  <Badge variant="outline" className="text-xs">
                                    {test.scoreReleaseMode === 'FULL_TEST' ? 'Full Review' :
                                     test.scoreReleaseMode === 'SCORE_WITH_WRONG' ? 'Score + Wrong' :
                                     test.scoreReleaseMode === 'SCORE_ONLY' ? 'Score Only' :
                                     'No Review'}
                                  </Badge>
                                )}
                              </div>
                              
                              {(() => {
                                const availability = checkTestAvailability(test)
                                return (
                                  <div className="flex flex-col items-end gap-2">
                                    {!availability.available && availability.reason && (
                                      <span className="text-xs text-muted-foreground">{availability.reason}</span>
                                    )}
                                    <Button
                                      onClick={() => handleTakeTest(test.id, test.clubId)}
                                      size="lg"
                                      disabled={!availability.available}
                                      className="bg-teamy-primary hover:bg-teamy-primary/90 text-white shadow-lg hover:shadow-xl transition-all duration-200 gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <Play className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                                      Take Test
                                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {selectedTournamentData.events.length === 0 && selectedTournamentData.generalTests.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No tests available</h3>
                    <p className="text-muted-foreground">
                      No tests have been released for this tournament yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          // Tournament list view
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">Testing Portal</h1>
              <p className="text-muted-foreground">
                View tournaments your team is registered for and access released tests
              </p>
            </div>

            {tournaments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No tournaments found</h3>
                  <p className="text-muted-foreground mb-4">
                    Your team is not registered for any tournaments yet.
                  </p>
                  <Link href="/tournaments">
                    <Button>Browse Tournaments</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tournaments.map((tournament) => {
                  const totalTests = tournament.events.reduce(
                    (sum, e) => sum + e.tests.length,
                    0
                  ) + tournament.generalTests.length
                  const totalEvents = tournament.events.length

                  return (
                    <Card
                      key={tournament.tournament.id}
                      className="hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => handleSetSelectedTournament(tournament.tournament.id)}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">
                            Division {formatDivision(tournament.tournament.division)}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl">{tournament.tournament.name}</CardTitle>
                        {tournament.tournament.location && (
                          <CardDescription className="flex items-center gap-1 mt-2">
                            <MapPin className="h-3 w-3" />
                            {tournament.tournament.location}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {formatDateRange(
                              tournament.tournament.startDate,
                              tournament.tournament.endDate
                            )}
                          </div>
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Events:</span>
                              <span className="font-medium">{totalEvents}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Tests:</span>
                              <span className="font-medium">{totalTests}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          className="w-full mt-4"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSetSelectedTournament(tournament.tournament.id)
                          }}
                        >
                          View Details
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Username Dialog */}
      <EditUsernameDialog
        open={editUsernameOpen}
        onOpenChange={setEditUsernameOpen}
        currentName={currentUserName}
        onNameUpdated={(newName) => {
          setCurrentUserName(newName)
          setEditUsernameOpen(false)
        }}
      />

      {/* Note Sheet Upload Dialog */}
      {noteSheetUploadOpen && (
        <NoteSheetUpload
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setNoteSheetUploadOpen(null)
            }
          }}
          testId={noteSheetUploadOpen}
          onSuccess={handleNoteSheetUploadSuccess}
          instructions={(() => {
            // Find the test to get its note sheet instructions
            if (!selectedTournamentData) return undefined
            for (const event of selectedTournamentData.events) {
              const test = event.tests.find(t => t.id === noteSheetUploadOpen)
              if (test) return test.noteSheetInstructions || undefined
            }
            const test = selectedTournamentData.generalTests.find(t => t.id === noteSheetUploadOpen)
            if (test) return test.noteSheetInstructions || undefined
            return undefined
          })()}
        />
      )}
    </div>
  )
}

