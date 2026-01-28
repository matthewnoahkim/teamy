'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Clock, Users, FileText, AlertCircle, Play, Eye, Trash2, Lock, Search, Edit, Calculator as CalcIcon, FileEdit, Settings, Copy } from 'lucide-react'
import { NoteSheetUpload } from '@/components/tests/note-sheet-upload'
import { Skeleton } from '@/components/ui/skeleton'
import { PageLoading } from '@/components/ui/loading-spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBackgroundRefresh } from '@/hooks/use-background-refresh'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { format } from 'date-fns'

interface TestsTabProps {
  clubId: string
  isAdmin: boolean
  initialTests?: any[]
}

interface Test {
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
  allowNoteSheet: boolean
  noteSheetInstructions: string | null
  releaseScoresAt: string | null
  maxAttempts: number | null
  scoreReleaseMode: 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST'
  createdAt: string
  updatedAt: string
  createdByMembershipId: string
  createdByMembership?: {
    id: string
    user: {
      id: string
      name: string | null
      email: string
    }
  }
  _count: {
    questions: number
    attempts: number
  }
}

interface UserAttemptInfo {
  attemptsUsed: number
  maxAttempts: number | null
  hasReachedLimit: boolean
}

// Memoized regex cache for highlightText
const regexCache = new Map<string, RegExp>()

// Helper function to highlight search terms in text (optimized with regex caching)
const highlightText = (text: string | null | undefined, searchQuery: string): string | (string | JSX.Element)[] => {
  if (!text || !searchQuery) return text || ''
  
  const query = searchQuery.trim()
  if (!query) return text
  
  // Use cached regex if available
  let regex = regexCache.get(query)
  if (!regex) {
    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    regex = new RegExp(`(${escapedQuery})`, 'gi')
    // Cache regex (limit cache size to prevent memory leaks)
    if (regexCache.size < 50) {
      regexCache.set(query, regex)
    }
  }
  
  // Split text using regex - alternate parts will be matches
  const parts = text.split(regex)
  
  // Check if part matches by comparing with original query (case-insensitive)
  // This avoids regex.test() which modifies lastIndex
  return parts.map((part, index) => {
    // Even indices are non-matches, odd indices are matches (due to capture group)
    const isMatch = index % 2 === 1
    return isMatch ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-900 text-foreground px-0.5 rounded">
        {part}
      </mark>
    ) : part
  })
}

export default function TestsTab({ clubId, isAdmin, initialTests }: TestsTabProps) {
  const { toast } = useToast()
  const router = useRouter()
  // Ensure initialTests have proper _count structure - memoize to prevent infinite loops
  const normalizedInitialTests = useMemo(() => {
    return initialTests?.map((test: any) => ({
      ...test,
      _count: {
        questions: test._count?.questions ?? 0,
        attempts: test._count?.attempts ?? 0,
      },
    })) || []
  }, [initialTests])
  const [tests, setTests] = useState<Test[]>(normalizedInitialTests)
  const [loading, setLoading] = useState(!initialTests) // Only show loading if we don't have initial data
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'scheduled' | 'opened' | 'completed'>('all')
  const [userAttempts, setUserAttempts] = useState<Map<string, UserAttemptInfo>>(new Map())
  const [noteSheets, setNoteSheets] = useState<Map<string, { status: string; rejectionReason: string | null }>>(new Map())

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [testToDelete, setTestToDelete] = useState<Test | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Note Sheet Dialogs
  const [noteSheetUploadOpen, setNoteSheetUploadOpen] = useState(false)
  const [noteSheetTestId, setNoteSheetTestId] = useState<string | null>(null)
  const [noteSheetInstructions, setNoteSheetInstructions] = useState<string | null>(null)

  // Warning Banner Dismissal
  const [warningDismissed, setWarningDismissed] = useState(false)
  
  // Track processed hash to prevent infinite loops
  const processedHashRef = useRef<string | null>(null)
  const testsRef = useRef<Test[]>(tests)
  const loadingRef = useRef(loading)
  
  // Keep refs in sync
  useEffect(() => {
    testsRef.current = tests
    loadingRef.current = loading
  }, [tests, loading])
  
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

  // Batch fetch user attempts and note sheets (now included in tests API response)
  const updateUserAttemptsAndNoteSheets = useCallback((userAttemptsData: Record<string, UserAttemptInfo>, noteSheetsData: Record<string, { status: string; rejectionReason: string | null }>) => {
    setUserAttempts(new Map(Object.entries(userAttemptsData)))
    setNoteSheets(new Map(Object.entries(noteSheetsData)))
  }, [])

  const fetchTests = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const response = await fetch(`/api/tests?clubId=${clubId}`)
      if (response.ok) {
        const data = await response.json()
        // Ensure _count structure exists
        const testsWithCount = data.tests.map((test: any) => ({
          ...test,
          _count: {
            questions: test._count?.questions ?? 0,
            attempts: test._count?.attempts ?? 0,
          },
        }))
        setTests(testsWithCount)

        // Update user attempts and note sheets from batched API response
        updateUserAttemptsAndNoteSheets(
          data.userAttempts || {},
          data.noteSheets || {}
        )
      } else {
        throw new Error('Failed to fetch tests')
      }
    } catch (error) {
      console.error('Failed to fetch tests:', error)
      toast({
        title: 'Error',
        description: 'Failed to load tests',
        variant: 'destructive',
      })
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [clubId, isAdmin, toast, updateUserAttemptsAndNoteSheets])

  useEffect(() => {
    // Skip initial fetch if we already have data from server
    if (!initialTests) {
      fetchTests()
    } else {
      // With initialTests, we still need to fetch user attempts and note sheets
      // Only fetch if we don't already have this data (avoid duplicate calls)
      if (userAttempts.size === 0 && noteSheets.size === 0) {
        const loadInitialData = async () => {
          try {
            const response = await fetch(`/api/tests?clubId=${clubId}`)
            if (response.ok) {
              const data = await response.json()
              updateUserAttemptsAndNoteSheets(
                data.userAttempts || {},
                data.noteSheets || {}
              )
            }
          } catch (error) {
            console.error('Failed to fetch user attempts and note sheets:', error)
          } finally {
            setLoading(false)
          }
        }
        loadInitialData()
      } else {
        // Already have data, just set loading to false
        setLoading(false)
      }
    }
  }, [fetchTests, initialTests, clubId, updateUserAttemptsAndNoteSheets, userAttempts.size, noteSheets.size])

  useBackgroundRefresh(
    () => fetchTests({ silent: true }),
    {
      intervalMs: 30_000,
      runOnMount: false,
    },
  )

  // Refresh attempts and note sheets when page becomes visible (user returns from test submission)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && tests.length > 0) {
        // Refresh user attempts and note sheets via single API call
        fetch(`/api/tests?clubId=${clubId}`)
          .then(res => res.json())
          .then(data => {
            updateUserAttemptsAndNoteSheets(
              data.userAttempts || {},
              data.noteSheets || {}
            )
          })
          .catch(err => console.error('Failed to refresh attempts and note sheets:', err))
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [tests, clubId, updateUserAttemptsAndNoteSheets])

  // Handle hash navigation - set up listener once, check hash when loading completes
  useEffect(() => {
    const handleHashNavigation = () => {
      // Check loading state from ref
      if (loadingRef.current) return
      
      const hash = window.location.hash
      if (!hash || !hash.startsWith('#test-')) {
        processedHashRef.current = null
        return
      }
      
      // Skip if we've already processed this exact hash
      if (processedHashRef.current === hash) return
      
      const testId = hash.replace('#test-', '')
      // Check if test exists using ref to avoid dependency issues
      const currentTests = testsRef.current
      const testExists = currentTests.some(t => t.id === testId)
      
      if (!testExists) return

      // Mark this hash as processed
      processedHashRef.current = hash

      // Wait for DOM to render, then scroll
      setTimeout(() => {
        const element = document.getElementById(`test-${testId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
          }, 2000)
        }
      }, 500)
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashNavigation)
    
    return () => {
      window.removeEventListener('hashchange', handleHashNavigation)
    }
  }, []) // Set up listener once

  // Check hash when loading completes
  useEffect(() => {
    if (loading) return
    
    // Use refs to check current state
    if (loadingRef.current) return
    if (testsRef.current.length === 0) return
    
    const hash = window.location.hash
    if (hash && hash.startsWith('#test-')) {
      // Reset processed hash so we can process it now
      processedHashRef.current = null
      // Small delay then check hash
      const timeoutId = setTimeout(() => {
        const testId = hash.replace('#test-', '')
        const testExists = testsRef.current.some(t => t.id === testId)
        if (testExists) {
          processedHashRef.current = hash
          const element = document.getElementById(`test-${testId}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
            }, 2000)
          }
        }
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
  }, [loading]) // Only run when loading changes

  const handleDeleteClick = (test: Test) => {
    setTestToDelete(test)
    setDeleteDialogOpen(true)
  }

  const handleDeleteTest = async () => {
    if (!testToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/tests/${testToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete test')
      }

      toast({
        title: 'Test Deleted',
        description: 'The test has been removed',
      })

      setDeleteDialogOpen(false)
      setTestToDelete(null)
      await fetchTests()
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

  const handleViewTest = useCallback((test: Test) => {
    // Navigate to test detail page
    // The page will automatically show the builder for drafts or detail view for published tests
    window.location.href = `/club/${clubId}/tests/${test.id}`
  }, [clubId])

  const handleViewResponses = useCallback((test: Test) => {
    // Navigate to test detail page with Responses tab (default)
    window.location.href = `/club/${clubId}/tests/${test.id}`
  }, [clubId])

  const handleViewSettings = useCallback((test: Test) => {
    // Navigate to test detail page with Settings tab
    window.location.href = `/club/${clubId}/tests/${test.id}?view=test`
  }, [clubId])

  const handleDuplicateTest = useCallback(async (testId: string) => {
    try {
      const response = await fetch(`/api/tests/${testId}/duplicate`, {
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
      await fetchTests()
    } catch (error: any) {
      console.error('Failed to duplicate test:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to duplicate test',
        variant: 'destructive',
      })
    }
  }, [toast, fetchTests])

  const handleTakeTest = useCallback((test: Test) => {
    // Navigate to test player
    window.location.href = `/club/${clubId}/tests/${test.id}/take`
  }, [clubId])

  const handleNoteSheetUpload = useCallback((testId: string) => {
    const test = tests.find(t => t.id === testId)
    setNoteSheetTestId(testId)
    setNoteSheetInstructions(test?.noteSheetInstructions || null)
    setNoteSheetUploadOpen(true)
  }, [tests])

  const handleNoteSheetSuccess = () => {
    // Refresh note sheets for the specific test
    if (noteSheetTestId) {
      fetch(`/api/tests/${noteSheetTestId}/note-sheets`)
        .then(res => res.json())
        .then(data => {
          if (data.noteSheet) {
            setNoteSheets(prev => {
              const updated = new Map(prev)
              updated.set(noteSheetTestId, {
                status: data.noteSheet.status,
                rejectionReason: data.noteSheet.rejectionReason || null,
              })
              return updated
            })
          }
        })
        .catch(err => console.error('Failed to refresh note sheet:', err))
    }
  }

  const getStatusBadge = (status: Test['status']) => {
    const config = {
      DRAFT: { label: 'Draft', variant: 'secondary' as const, color: 'text-gray-600' },
      PUBLISHED: { label: 'Published', variant: 'default' as const, color: 'text-green-600' },
      CLOSED: { label: 'Closed', variant: 'destructive' as const, color: 'text-red-600' },
    }
    const { label, variant } = config[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  const isTestAvailable = (test: Test): boolean => {
    if (test.status !== 'PUBLISHED') return false
    const now = new Date()
    if (test.startAt && now < new Date(test.startAt)) return false
    if (test.endAt) {
      const deadline = test.allowLateUntil ? new Date(test.allowLateUntil) : new Date(test.endAt)
      if (now > deadline) return false
    }
    return true
  }

  const getTestTimeInfo = (test: Test): string => {
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
    const draftsList: Test[] = []
    const scheduledList: Test[] = []
    const openedList: Test[] = []
    const completedList: Test[] = []

    // Apply search filter
    let filteredTests = tests
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filteredTests = tests.filter((test) =>
        test.name.toLowerCase().includes(query) ||
        test.description?.toLowerCase().includes(query)
      )
    }

    filteredTests.forEach((test) => {
      if (test.status === 'DRAFT') {
        if (isAdmin) {
          draftsList.push(test)
        }
        // Non-admins do not see drafts
      } else if (test.status === 'PUBLISHED') {
        const startAt = test.startAt ? new Date(test.startAt) : null
        const endAt = test.endAt ? new Date(test.endAt) : null
        const allowLateUntil = test.allowLateUntil ? new Date(test.allowLateUntil) : null
        const deadline = allowLateUntil || endAt
        const isPastEnd = deadline ? now > deadline : false
        const isScheduled = startAt && now < startAt

        // Check if user has reached max attempts (for non-admins)
        // Only check for limited attempts (maxAttempts !== null)
        let userReachedLimit = false
        if (!isAdmin && test.maxAttempts !== null) {
          const attemptInfo = userAttempts.get(test.id)
          userReachedLimit = attemptInfo?.hasReachedLimit || false
        }

        // For admins: completed = past end date only
        // For users with limited attempts: completed = past end date OR reached max attempts
        // For users with unlimited attempts: completed = past end date only (not based on attempts)
        const isCompleted = isPastEnd || (test.maxAttempts !== null && userReachedLimit)

        if (isScheduled) {
          scheduledList.push(test)
        } else if (isCompleted) {
          completedList.push(test)
        } else {
          openedList.push(test)
        }
      } else if (test.status === 'CLOSED') {
        completedList.push(test)
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
  }, [tests, searchQuery, statusFilter, isAdmin, userAttempts])

  const renderTestCard = useCallback((test: Test) => {
    const getCalculatorTypeLabel = () => {
      if (!test.allowCalculator || !test.calculatorType) return null
      if (test.calculatorType === 'FOUR_FUNCTION') return 'Four Function'
      if (test.calculatorType === 'SCIENTIFIC') return 'Scientific'
      return 'Graphing'
    }

    const calculatorTypeLabel = getCalculatorTypeLabel()
    const creatorName = test.createdByMembership?.user?.name || test.createdByMembership?.user?.email || 'Unknown'
    const attemptCount = test._count?.attempts ?? 0

    return (
      <Card key={test.id} id={`test-${test.id}`}>
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
              </div>
              {test.description && (
                <CardDescription className="mb-2">
                  {searchQuery ? highlightText(test.description, searchQuery) : test.description}
                </CardDescription>
              )}
              <div className={`flex items-center gap-3 text-sm text-muted-foreground ${test.status === 'DRAFT' ? 'mt-2 mb-0' : 'mt-3 mb-1'}`}>
                {test.status === 'PUBLISHED' ? (
                  <>
                    <span>{test._count?.questions ?? 0} question{(test._count?.questions ?? 0) !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{test.durationMinutes} minute{test.durationMinutes !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{attemptCount} attempt{attemptCount !== 1 ? 's' : ''}</span>
                    {calculatorTypeLabel && (
                      <>
                        <span>•</span>
                        <span>{calculatorTypeLabel}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>Created by {creatorName}</span>
                    {test.updatedAt && test.updatedAt !== test.createdAt && (
                      <>
                        <span>•</span>
                        <span>Last edited {format(new Date(test.updatedAt), 'MMM d, yyyy')}</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span>{test._count?.questions ?? 0} question{(test._count?.questions ?? 0) !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{test.durationMinutes} minute{test.durationMinutes !== 1 ? 's' : ''}</span>
                    {calculatorTypeLabel && (
                      <>
                        <span>•</span>
                        <span>{calculatorTypeLabel}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>Created by {creatorName}</span>
                    {test.updatedAt && test.updatedAt !== test.createdAt && (
                      <>
                        <span>•</span>
                        <span>Last edited by {format(new Date(test.updatedAt), 'MMM d, yyyy')}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            {isAdmin && (
              <TooltipProvider>
                <div className="flex gap-2">
                  {test.status === 'DRAFT' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewTest(test)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewResponses(test)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Responses
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicateTest(test.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Duplicate</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewSettings(test)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Settings</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteClick(test)}
                        className="text-red-600 hover:text-red-700"
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
            )}
          </div>
        </CardHeader>
        <CardContent className={test.status === 'DRAFT' ? 'pt-0 pb-0' : ''}>

        {test.status === 'PUBLISHED' && test.startAt && test.allowNoteSheet && (() => {
          const noteSheet = noteSheets.get(test.id)
          const hasNoteSheet = noteSheet !== undefined
          
          return (
            <div className="mb-4 space-y-2">
              {!hasNoteSheet ? (
                <Button
                  onClick={() => handleNoteSheetUpload(test.id)}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <FileEdit className="h-4 w-4 mr-2" />
                  Upload Note Sheet
                </Button>
              ) : (
                <div className="space-y-2">
                  {noteSheet.status === 'PENDING' && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                            Note Sheet Pending Review
                          </p>
                          <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                            Your note sheet is awaiting admin review.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {noteSheet.status === 'ACCEPTED' && (
                    <div className="p-3 bg-green-500 dark:bg-green-600 border border-green-600 dark:border-green-700 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FileText className="h-5 w-5 text-black dark:text-white flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-black dark:text-white">
                            Note Sheet Accepted
                          </p>
                          <p className="text-xs text-black/80 dark:text-white/80 mt-1">
                            Your note sheet has been approved and will be available during the test.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {noteSheet.status === 'REJECTED' && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-2">
                          <div>
                            <p className="text-sm font-medium text-red-900 dark:text-red-100">
                              Note Sheet Rejected
                            </p>
                            {noteSheet.rejectionReason && noteSheet.rejectionReason.trim() ? (
                              <div className="mt-2 p-3 bg-white dark:bg-red-950/40 rounded border-2 border-red-300 dark:border-red-700">
                                <p className="text-xs font-semibold text-red-900 dark:text-red-100 mb-1.5 uppercase tracking-wide">
                                  Admin Comments:
                                </p>
                                <p className="text-sm text-red-900 dark:text-red-100 whitespace-pre-wrap leading-relaxed">
                                  {noteSheet.rejectionReason}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                                No comments provided by admin.
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleNoteSheetUpload(test.id)}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <FileEdit className="h-4 w-4 mr-2" />
                            Upload New Note Sheet
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {test.status === 'PUBLISHED' && (
          <div className="flex gap-2">
            {(() => {
              const attemptInfo = userAttempts.get(test.id)
              const hasCompletedAttempt = attemptInfo && attemptInfo.attemptsUsed > 0
              const canTakeTest = isTestAvailable(test) && !attemptInfo?.hasReachedLimit
              
              // Show both buttons if user has completed attempt(s) and can still take more
              if (hasCompletedAttempt && canTakeTest) {
                return (
                  <div className="flex gap-2 w-full">
                    <Button
                      onClick={() => handleTakeTest(test)}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {test.maxAttempts === null ? 'Retake Test' : 'Take Test'}
                    </Button>
                    <Button
                      onClick={() => router.push(`/club/${clubId}/tests/${test.id}/results`)}
                      className="flex-1"
                      variant="outline"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  </div>
                )
              }

              // Show only "View Results" if user has completed attempts but can't take more
              if (hasCompletedAttempt) {
                return (
                  <Button
                    onClick={() => router.push(`/club/${clubId}/tests/${test.id}/results`)}
                    className="w-full"
                    variant="outline"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Results
                  </Button>
                )
              }

              // Show only "Take Test" if user hasn't completed any attempts yet
              return (
                <Button
                  onClick={() => handleTakeTest(test)}
                  disabled={!isTestAvailable(test)}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isTestAvailable(test) ? 'Take Test' : 'Not Available'}
                </Button>
              )
            })()}
          </div>
        )}
      </CardContent>
    </Card>
    )
  }, [clubId, isAdmin, router, searchQuery, userAttempts, noteSheets, handleTakeTest, handleViewTest, handleViewResponses, handleViewSettings, handleDuplicateTest, handleNoteSheetUpload])

  if (loading) {
    return (
      <PageLoading
        title="Loading tests"
        description="Fetching available tests and your progress..."
        variant="orbit"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Tests</h2>
            <p className="text-muted-foreground">
              {isAdmin ? 'Create and manage tests for your team' : 'View and take available tests'}
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => router.push(`/club/${clubId}/tests/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Test
            </Button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10 shrink-0 will-change-transform" />
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
              {isAdmin && <SelectItem value="draft">Drafts</SelectItem>}
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="opened">Opened</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Warning Banner - Admin Only */}
      {isAdmin && !warningDismissed && (
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
      {tests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No tests yet</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Create your first test to get started' : 'Check back later for available tests'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {/* Drafts Section - Admin Only */}
          {isAdmin && drafts.length > 0 && (
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
          {(!isAdmin || drafts.length === 0) && scheduled.length === 0 && opened.length === 0 && completed.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No tests available</p>
                <p className="text-sm text-muted-foreground">
                  {isAdmin ? 'Create your first test to get started' : 'Check back later for available tests'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{testToDelete?.name}&quot;? This will also delete all attempts 
              and cannot be undone.
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
            <Button variant="destructive" onClick={handleDeleteTest} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Sheet Upload */}
      {noteSheetTestId && (
        <NoteSheetUpload
          open={noteSheetUploadOpen}
          onOpenChange={(open) => {
            setNoteSheetUploadOpen(open)
            if (!open) {
              setNoteSheetTestId(null)
              setNoteSheetInstructions(null)
            }
          }}
          testId={noteSheetTestId}
          instructions={noteSheetInstructions}
          onSuccess={handleNoteSheetSuccess}
        />
      )}
    </div>
  )
}

