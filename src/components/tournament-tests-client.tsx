'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AppHeader } from '@/components/app-header'
import { useToast } from '@/components/ui/use-toast'
import { PageLoading } from '@/components/ui/loading-spinner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Clock,
  FileText,
  AlertCircle,
  Edit,
  Trash2,
  Lock,
  Search,
  Calculator as CalcIcon,
} from 'lucide-react'

interface TournamentTest {
  id: string
  tournamentId: string
  testId: string
  eventId: string | null
  test: {
    id: string
    name: string
    description: string | null
    status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
    durationMinutes: number
    startAt: string | null
    endAt: string | null
    allowLateUntil: string | null
    requireFullscreen: boolean
    allowCalculator: boolean
    calculatorType: 'FOUR_FUNCTION' | 'SCIENTIFIC' | 'GRAPHING' | null
    maxAttempts: number | null
    clubId: string
    team: {
      id: string
      name: string
    }
    _count: {
      questions: number
      attempts: number
    }
  }
  event: {
    id: string
    name: string
    slug: string
  } | null
}

interface TournamentTestsClientProps {
  tournamentId: string
  tournamentName: string
  tournamentDivision: 'B' | 'C'
  events: Array<{
    id: string
    name: string
    slug: string
  }>
  userClubs: Array<{
    id: string
    name: string
    division: 'B' | 'C'
  }>
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
}

// Helper function to highlight search terms in text (exact copy from dev panel)
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

export function TournamentTestsClient({
  tournamentId,
  tournamentName,
  tournamentDivision,
  events,
  userClubs,
  user,
}: TournamentTestsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [tournamentTests, setTournamentTests] = useState<TournamentTest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'scheduled' | 'opened' | 'completed'>('all')
  const [removingTestId, setRemovingTestId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [testToDelete, setTestToDelete] = useState<TournamentTest | null>(null)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigningTest, setAssigningTest] = useState<string | null>(null)
  const [selectedAssignEventId, setSelectedAssignEventId] = useState<string>('')
  const [warningDismissed, setWarningDismissed] = useState(false)

  useEffect(() => {
    // Check if warning was dismissed forever
    const dismissedForever = localStorage.getItem('test-lockdown-warning-dismissed')
    if (dismissedForever === 'true') {
      setWarningDismissed(true)
    }
  }, [])

  const handleDismissWarning = (forever: boolean) => {
    setWarningDismissed(true)
    if (forever) {
      localStorage.setItem('test-lockdown-warning-dismissed', 'true')
    }
  }

  useEffect(() => {
    loadTournamentTests()
  }, [])

  const loadTournamentTests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tournaments/${tournamentId}/tests`)
      if (!response.ok) throw new Error('Failed to load tournament tests')
      const data = await response.json()
      setTournamentTests(data.tests || [])
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load tournament tests',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (tournamentTest: TournamentTest) => {
    setTestToDelete(tournamentTest)
    setDeleteDialogOpen(true)
  }

  const handleRemoveTest = async () => {
    if (!testToDelete) return

    try {
      setRemovingTestId(testToDelete.testId)
      const response = await fetch(`/api/tournaments/${tournamentId}/tests?testId=${testToDelete.testId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove test')
      }

      toast({
        title: 'Success',
        description: 'Test removed from tournament successfully',
      })

      setDeleteDialogOpen(false)
      setTestToDelete(null)
      loadTournamentTests()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove test',
        variant: 'destructive',
      })
    } finally {
      setRemovingTestId(null)
    }
  }

  const handleAssignTest = async (testId: string) => {
    if (!selectedAssignEventId) {
      toast({
        title: 'Error',
        description: 'Please select an event',
        variant: 'destructive',
      })
      return
    }

    try {
      setAssigningTest(testId)
      const response = await fetch(`/api/tournaments/${tournamentId}/assign-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          eventId: selectedAssignEventId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to assign test')
      }

      const data = await response.json()
      toast({
        title: 'Success',
        description: data.message || 'Test assigned successfully',
      })

      setAssignDialogOpen(false)
      setAssigningTest(null)
      setSelectedAssignEventId('')
      loadTournamentTests()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign test',
        variant: 'destructive',
      })
    } finally {
      setAssigningTest(null)
    }
  }

  const handleViewTest = (tournamentTest: TournamentTest) => {
    // Navigate to team's test detail page for editing
    router.push(`/club/${tournamentTest.test.clubId}/tests/${tournamentTest.test.id}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="default">Published</Badge>
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>
      case 'CLOSED':
        return <Badge variant="destructive">Closed</Badge>
      default:
        return null
    }
  }

  const getTestTimeInfo = (test: TournamentTest['test']): string => {
    if (!test.startAt) {
      return test.status === 'DRAFT' ? 'Set start time when publishing' : 'No start time set'
    }
    const start = new Date(test.startAt)
    const end = test.endAt ? new Date(test.endAt) : null
    const now = new Date()

    if (now < start) {
      return `Starts ${start.toLocaleDateString()} at ${start.toLocaleTimeString()}`
    }
    if (end && now > end) {
      return `Ended ${end.toLocaleDateString()}`
    }
    if (end) {
      return `Ends ${end.toLocaleDateString()} at ${end.toLocaleTimeString()}`
    }
    return 'Available now'
  }

  // Categorize tests into sections
  const { drafts, scheduled, opened, completed } = useMemo(() => {
    const now = new Date()
    const draftsList: TournamentTest[] = []
    const scheduledList: TournamentTest[] = []
    const openedList: TournamentTest[] = []
    const completedList: TournamentTest[] = []

    // Apply search filter
    let filteredTests = tournamentTests
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filteredTests = tournamentTests.filter((tt) =>
        tt.test.name.toLowerCase().includes(query) ||
        tt.test.description?.toLowerCase().includes(query)
      )
    }

    filteredTests.forEach((tournamentTest) => {
      const test = tournamentTest.test
      if (test.status === 'DRAFT') {
        draftsList.push(tournamentTest)
      } else if (test.status === 'PUBLISHED') {
        const startAt = test.startAt ? new Date(test.startAt) : null
        const endAt = test.endAt ? new Date(test.endAt) : null
        const allowLateUntil = test.allowLateUntil ? new Date(test.allowLateUntil) : null
        const deadline = allowLateUntil || endAt
        const isPastEnd = deadline ? now > deadline : false
        const isScheduled = startAt && now < startAt

        if (isScheduled) {
          scheduledList.push(tournamentTest)
        } else if (isPastEnd) {
          completedList.push(tournamentTest)
        } else {
          openedList.push(tournamentTest)
        }
      } else if (test.status === 'CLOSED') {
        completedList.push(tournamentTest)
      }
    })

    // Apply status filter
    if (statusFilter === 'draft') {
      return { drafts: draftsList, scheduled: [], opened: [], completed: [] }
    } else if (statusFilter === 'scheduled') {
      return { drafts: [], scheduled: scheduledList, opened: [], completed: [] }
    } else if (statusFilter === 'opened') {
      return { drafts: [], scheduled: [], opened: openedList, completed: [] }
    } else if (statusFilter === 'completed') {
      return { drafts: [], scheduled: [], opened: [], completed: completedList }
    }

    return { drafts: draftsList, scheduled: scheduledList, opened: openedList, completed: completedList }
  }, [tournamentTests, searchQuery, statusFilter])

  const renderTestCard = (tournamentTest: TournamentTest) => {
    const test = tournamentTest.test
    return (
      <Card key={tournamentTest.id} id={`test-${test.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle>
                  {searchQuery ? highlightText(test.name, searchQuery) : test.name}
                </CardTitle>
                {getStatusBadge(test.status)}
                {test.requireFullscreen && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Lockdown
                  </Badge>
                )}
                {test.allowCalculator && test.calculatorType && (
                  <Badge variant="outline" className="gap-1">
                    <CalcIcon className="h-3 w-3" />
                    {test.calculatorType === 'FOUR_FUNCTION' ? 'Basic Calc' :
                     test.calculatorType === 'SCIENTIFIC' ? 'Scientific Calc' :
                     'Graphing Calc'}
                  </Badge>
                )}
                {tournamentTest.event && (
                  <Badge variant="outline">
                    Event: {tournamentTest.event.name}
                  </Badge>
                )}
              </div>
              {test.description && (
                <CardDescription>
                  {searchQuery ? highlightText(test.description, searchQuery) : test.description}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleViewTest(tournamentTest)}
              >
                {test.status === 'DRAFT' ? (
                  <>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteClick(tournamentTest)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{test.durationMinutes} minutes</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{test._count?.questions ?? 0} questions</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{test._count?.attempts ?? 0} attempts</span>
            </div>
            <div className="text-sm text-muted-foreground col-span-2 md:col-span-1">
              {getTestTimeInfo(test)}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid-pattern">
        <AppHeader user={user} />
        <PageLoading title="Loading tournament tests" description="Fetching test information..." />
      </div>
    )
  }

  const allTests = [...drafts, ...scheduled, ...opened, ...completed]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern">
      <AppHeader user={user} />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => router.push(`/tournaments/${tournamentId}/manage`)} variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tournament Management
          </Button>
        </div>

        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Tests</h2>
                <p className="text-muted-foreground">
                  Create and manage tests for {tournamentName}
                </p>
              </div>
              <Button onClick={() => {
                sessionStorage.setItem('tournamentId', tournamentId)
                router.push(`/tournaments/${tournamentId}/tests/new`)
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Test
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10 shrink-0" />
                <Input
                  type="text"
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger className="h-12 w-[180px]">
                  <SelectValue placeholder="All Tests" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tests</SelectItem>
                  <SelectItem value="draft">Drafts</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Warning Banner */}
          {!warningDismissed && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex gap-2 sm:gap-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5 sm:space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-orange-900 dark:text-orange-100">
                      Browser Lockdown Limitations
                    </p>
                    <p className="text-xs sm:text-sm text-orange-800 dark:text-orange-200 leading-relaxed">
                      The test lockdown is <strong>best-effort</strong> and cannot prevent all cheating methods
                      (secondary devices, physical notes, screen sharing). For high-stakes tests, combine with
                      live proctoring or supervised testing environments.
                    </p>
                    <div className="flex gap-2 mt-2 sm:mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismissWarning(false)}
                        className="h-7 sm:h-7 text-[10px] sm:text-xs text-orange-800 dark:text-orange-200 hover:text-orange-900 dark:hover:text-orange-100 px-2 sm:px-3"
                      >
                        Dismiss
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismissWarning(true)}
                        className="h-7 sm:h-7 text-[10px] sm:text-xs text-orange-800 dark:text-orange-200 hover:text-orange-900 dark:hover:text-orange-100 px-2 sm:px-3"
                      >
                        Don&apos;t show again
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tests List - Organized by Sections */}
          {allTests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No tests yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first test to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-10">
              {/* Drafts Section */}
              {drafts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                    <h3 className="text-xl font-bold">Drafts</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {drafts.length}
                    </Badge>
                  </div>
                  <div className="grid gap-4">
                    {drafts.map(renderTestCard)}
                  </div>
                </div>
              )}

              {/* Scheduled Section */}
              {scheduled.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border">
                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                    <h3 className="text-xl font-bold">Scheduled</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {scheduled.length}
                    </Badge>
                  </div>
                  <div className="grid gap-4">
                    {scheduled.map(renderTestCard)}
                  </div>
                </div>
              )}

              {/* Opened Section */}
              {opened.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border">
                    <div className="h-1 w-1 rounded-full bg-green-500" />
                    <h3 className="text-xl font-bold">Opened</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {opened.length}
                    </Badge>
                  </div>
                  <div className="grid gap-4">
                    {opened.map(renderTestCard)}
                  </div>
                </div>
              )}

              {/* Completed Section */}
              {completed.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-border">
                    <div className="h-1 w-1 rounded-full bg-gray-500" />
                    <h3 className="text-xl font-bold">Completed</h3>
                    <Badge variant="secondary" className="ml-auto">
                      {completed.length}
                    </Badge>
                  </div>
                  <div className="grid gap-4">
                    {completed.map(renderTestCard)}
                  </div>
                </div>
              )}

              {/* Empty State if no tests in visible sections */}
              {drafts.length === 0 && scheduled.length === 0 && opened.length === 0 && completed.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No tests available</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first test to get started
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Test</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove &quot;{testToDelete?.test.name}&quot; from this tournament? This will not delete the test itself, only remove it from the tournament.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setTestToDelete(null)
                }}
                disabled={!!removingTestId}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveTest}
                disabled={!!removingTestId}
              >
                {removingTestId ? 'Removing...' : 'Remove Test'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Test Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Test to Event</DialogTitle>
              <DialogDescription>
                Assign this test to all teams registered for the selected event. The test will be assigned to team members who have this event in their roster.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="assign-event-select">Event</Label>
                <Select
                  value={selectedAssignEventId}
                  onValueChange={setSelectedAssignEventId}
                >
                  <SelectTrigger id="assign-event-select">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAssignDialogOpen(false)
                  setSelectedAssignEventId('')
                  setAssigningTest(null)
                }}
                disabled={!!assigningTest}
              >
                Cancel
              </Button>
              <Button
                onClick={() => assigningTest && handleAssignTest(assigningTest)}
                disabled={!!assigningTest || !selectedAssignEventId}
              >
                {assigningTest ? 'Assigning...' : 'Assign Test'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
