'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ButtonLoading } from '@/components/ui/loading-spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { generateClientFingerprint } from '@/lib/test-security-client'
import { Clock, Lock, AlertCircle, Calculator as CalcIcon, Flag, ArrowLeft } from 'lucide-react'
import { CalculatorButton } from '@/components/tests/calculator'
import { QuestionPrompt } from '@/components/tests/question-prompt'
import { NoteSheetViewer } from '@/components/tests/note-sheet-viewer'

interface TakeTestClientProps {
  test: any
  membership: any
  existingAttempt: any
  isAdmin: boolean
  tournamentId?: string
  testingPortal?: boolean
}


export function TakeTestClient({
  test,
  membership,
  existingAttempt,
  isAdmin,
  tournamentId,
  testingPortal,
}: TakeTestClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [attempt, setAttempt] = useState<any>(existingAttempt)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [started, setStarted] = useState(!!existingAttempt)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set())
  const [tabSwitchCount, setTabSwitchCount] = useState(existingAttempt?.tabSwitchCount || 0)
  const [timeOffPageSeconds, setTimeOffPageSeconds] = useState(existingAttempt?.timeOffPageSeconds || 0)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [offPageStartTime, setOffPageStartTime] = useState<number | null>(null)
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isExitingRef = useRef(false) // Track when we're intentionally exiting (Save & Exit)
  const [needsFullscreenPrompt, setNeedsFullscreenPrompt] = useState(false) // Track if we need user interaction to enter fullscreen
  const [showSaveExitDialog, setShowSaveExitDialog] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null) // Time remaining in seconds
  const pausedAtRef = useRef<number | null>(null) // Timestamp when user saved and exited
  const totalPausedSecondsRef = useRef<number>(0) // Total seconds paused (accumulated)
  const attemptRef = useRef(attempt) // Keep ref to latest attempt for back button handler
  const tabSwitchCountRef = useRef(tabSwitchCount) // Ref for tab switch count to avoid dependency
  const timeOffPageSecondsRef = useRef(timeOffPageSeconds) // Ref for time off page to avoid dependency
  const offPageStartTimeRef = useRef(offPageStartTime) // Ref for off page start time to avoid dependency
  const testIdRef = useRef(test.id) // Ref for test ID to avoid dependency
  const tournamentIdRef = useRef(tournamentId) // Ref for tournament ID to avoid dependency

  // Load existing answers
  useEffect(() => {
    if (existingAttempt?.answers) {
      const loadedAnswers: Record<string, any> = {}
      const markedQuestions = new Set<string>()
      existingAttempt.answers.forEach((answer: any) => {
        // For fill-in-the-blank, parse the answerText back into blankAnswers array
        let blankAnswers: string[] | undefined = undefined
        if (answer.answerText && answer.answerText.includes(' | ')) {
          blankAnswers = answer.answerText.split(' | ')
        }
        
        loadedAnswers[answer.questionId] = {
          answerText: answer.answerText,
          selectedOptionIds: answer.selectedOptionIds || [],
          numericAnswer: answer.numericAnswer,
          blankAnswers,
        }
        if (answer.markedForReview) {
          markedQuestions.add(answer.questionId)
        }
      })
      setAnswers(loadedAnswers)
      setMarkedForReview(markedQuestions)
    }
  }, [existingAttempt])

  // When resuming a test, calculate paused time if user had saved and exited
  useEffect(() => {
    if (started && attempt && existingAttempt && attempt.startedAt) {
      // Check if this is a resume (attempt exists and was previously started)
      // If there's a pausedAt timestamp in localStorage, calculate the pause duration
      const pausedAtKey = `test_paused_${attempt.id}`
      const pausedAtStr = localStorage.getItem(pausedAtKey)
      
      if (pausedAtStr) {
        const pausedAt = parseInt(pausedAtStr, 10)
        const now = Date.now()
        const pauseDuration = Math.floor((now - pausedAt) / 1000)
        totalPausedSecondsRef.current += pauseDuration
        // Clear the paused timestamp
        localStorage.removeItem(pausedAtKey)
      }
    }
  }, [started, attempt, existingAttempt])

  // Enter fullscreen when starting or resuming a test
  // This runs when:
  // 1. Component mounts with an existing attempt (resume) - needs user interaction
  // 2. User starts a new test (started becomes true) - can request immediately
  useEffect(() => {
    // Reset exit flag when starting/resuming (component mount or started changes)
    isExitingRef.current = false
    
    if (started && test.requireFullscreen && attempt) {
      // If we're resuming (existingAttempt was passed), we need user interaction
      // Browsers block fullscreen requests that aren't in response to user gestures
      if (existingAttempt && !document.fullscreenElement) {
        setNeedsFullscreenPrompt(true)
        return
      }
      
      // For new starts, we can request immediately (user just clicked "Start Test")
      if (!document.fullscreenElement && !isExitingRef.current) {
        document.documentElement.requestFullscreen().catch((error) => {
          console.warn('Failed to enter fullscreen:', error)
          setNeedsFullscreenPrompt(true)
        })
      }
    } else {
      setNeedsFullscreenPrompt(false)
    }
  }, [started, test.requireFullscreen, attempt, existingAttempt, toast])

  // Handler for user-initiated fullscreen entry (required for resume)
  const handleEnterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
      setNeedsFullscreenPrompt(false)
    } catch (error) {
      console.warn('Failed to enter fullscreen:', error)
      toast({
        title: 'Fullscreen Required',
        description: 'Please enable fullscreen mode to continue this test',
        variant: 'destructive',
      })
    }
  }

  // Keep refs updated
  useEffect(() => {
    attemptRef.current = attempt
    tabSwitchCountRef.current = tabSwitchCount
    timeOffPageSecondsRef.current = timeOffPageSeconds
    offPageStartTimeRef.current = offPageStartTime
    testIdRef.current = test.id
    tournamentIdRef.current = tournamentId
  }, [attempt, tabSwitchCount, timeOffPageSeconds, offPageStartTime, test.id, tournamentId])

  // Track page visibility and tab switching
  useEffect(() => {
    const recordProctorEvent = async (kind: string, meta?: any) => {
      const currentAttempt = attemptRef.current
      if (!currentAttempt || currentAttempt.status !== 'IN_PROGRESS') return
      
      try {
        // Use ES endpoint if tournamentId is present (ES test), otherwise use regular endpoint
        const endpoint = tournamentIdRef.current 
          ? `/api/es/tests/${testIdRef.current}/attempts/${currentAttempt.id}/proctor-events`
          : `/api/tests/${testIdRef.current}/attempts/${currentAttempt.id}/proctor-events`
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, meta }),
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('Failed to record proctor event:', response.status, errorData)
        }
      } catch (error) {
        console.error('Failed to record proctor event:', error)
      }
    }

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      setIsPageVisible(isVisible)

      if (!isVisible) {
        // User switched away - record when they left
        const leftAt = Date.now()
        setOffPageStartTime(leftAt)
        setTabSwitchCount((prev: number) => prev + 1)
      } else {
        // User returned - record TAB_SWITCH with time off site
        const currentOffPageStartTime = offPageStartTimeRef.current
        if (currentOffPageStartTime) {
          const timeOff = Math.floor((Date.now() - currentOffPageStartTime) / 1000)
          setTimeOffPageSeconds((prev: number) => prev + timeOff)
          recordProctorEvent('TAB_SWITCH', { 
            timeOffSeconds: timeOff,
            leftAt: new Date(currentOffPageStartTime).toISOString(),
            returnedAt: new Date().toISOString()
          })
          setOffPageStartTime(null)
        }
      }
    }

    const handleBlur = () => {
      if (document.hidden) {
        // User switched away - record when they left
        const leftAt = Date.now()
        setOffPageStartTime(leftAt)
        setTabSwitchCount((prev: number) => prev + 1)
      }
    }

    const handleFocus = () => {
      const currentOffPageStartTime = offPageStartTimeRef.current
      if (currentOffPageStartTime) {
        const timeOff = Math.floor((Date.now() - currentOffPageStartTime) / 1000)
        setTimeOffPageSeconds((prev: number) => prev + timeOff)
        // Record the time off site in the meta when returning
        recordProctorEvent('TAB_SWITCH', { 
          timeOffSeconds: timeOff,
          leftAt: new Date(currentOffPageStartTime).toISOString(),
          returnedAt: new Date().toISOString()
        })
        setOffPageStartTime(null)
      }
    }

    // Handle fullscreen changes - show prompt when user exits fullscreen
    const handleFullscreenChange = () => {
      // Don't show prompt if we're intentionally exiting (Save & Exit)
      if (isExitingRef.current) {
        return
      }
      
      // If user manually exited fullscreen while test is active, show the prompt and record event
      if (test.requireFullscreen && started && attempt && !document.fullscreenElement) {
        // User manually exited fullscreen (e.g., pressed Escape) - show prompt
        setNeedsFullscreenPrompt(true)
        recordProctorEvent('EXIT_FULLSCREEN', { timestamp: Date.now() })
      } else if (document.fullscreenElement && needsFullscreenPrompt) {
        // Fullscreen was entered - hide the prompt
        setNeedsFullscreenPrompt(false)
      }
    }

    // Detect DevTools opening/closing
    const detectDevTools = () => {
      let devtools = { open: false, orientation: null as string | null }
      const threshold = 160
      
      const checkDevTools = () => {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
          if (!devtools.open) {
            devtools.open = true
            recordProctorEvent('DEVTOOLS_OPEN', { timestamp: Date.now() })
          }
        } else {
          devtools.open = false
        }
      }
      
      // Check periodically
      const devtoolsInterval = setInterval(checkDevTools, 500)
      
      return () => clearInterval(devtoolsInterval)
    }

    // Handle paste events
    const handlePaste = (e: ClipboardEvent) => {
      recordProctorEvent('PASTE', { 
        timestamp: Date.now(),
        dataLength: e.clipboardData?.getData('text').length || 0
      })
    }

    // Handle copy events
    const handleCopy = (e: ClipboardEvent) => {
      recordProctorEvent('COPY', { 
        timestamp: Date.now(),
        dataLength: window.getSelection()?.toString().length || 0
      })
    }

    // Handle context menu (right-click)
    const handleContextMenu = (e: MouseEvent) => {
      recordProctorEvent('CONTEXTMENU', { timestamp: Date.now() })
    }

    if (started && attempt) {
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('blur', handleBlur)
      window.addEventListener('focus', handleFocus)
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      document.addEventListener('paste', handlePaste)
      document.addEventListener('copy', handleCopy)
      document.addEventListener('contextmenu', handleContextMenu)

      // Start DevTools detection
      const devtoolsCleanup = detectDevTools()

      // Periodically update tab tracking on server
      trackingIntervalRef.current = setInterval(async () => {
        const currentAttempt = attemptRef.current
        if (currentAttempt && currentAttempt.status === 'IN_PROGRESS') {
          try {
            // Use ES endpoint if tournamentId is present (ES test), otherwise use regular endpoint
            const endpoint = tournamentIdRef.current 
              ? `/api/es/tests/${testIdRef.current}/attempts/${currentAttempt.id}/tab-tracking`
              : `/api/tests/${testIdRef.current}/attempts/${currentAttempt.id}/tab-tracking`
            
            const response = await fetch(endpoint, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tabSwitchCount: tabSwitchCountRef.current,
                timeOffPageSeconds: timeOffPageSecondsRef.current,
              }),
            })
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              console.error('Failed to update tab tracking:', response.status, errorData)
            }
          } catch (error) {
            console.error('Failed to update tab tracking:', error)
          }
        }
      }, 10000) // Update every 10 seconds

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('blur', handleBlur)
        window.removeEventListener('focus', handleFocus)
        document.removeEventListener('fullscreenchange', handleFullscreenChange)
        document.removeEventListener('paste', handlePaste)
        document.removeEventListener('copy', handleCopy)
        document.removeEventListener('contextmenu', handleContextMenu)
        devtoolsCleanup()
        if (trackingIntervalRef.current) {
          clearInterval(trackingIntervalRef.current)
        }
      }
    }

    return () => {
      // Cleanup if not started
    }
  }, [started, attempt, test.requireFullscreen]) // Reduced dependencies - using refs for values only read in callbacks

  const handleStartTest = async () => {
    if (test.testPasswordHash && !isAdmin && !password) {
      setPasswordError('Password is required')
      return
    }

    setLoading(true)
    setPasswordError('')

    try {
      const fingerprint = await generateClientFingerprint({
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })

      const response = await fetch(`/api/tests/${test.id}/attempts/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint,
          testPassword: password || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'NEED_TEST_PASSWORD') {
          setPasswordError(data.message || 'Invalid password')
        } else if (data.error === 'Maximum attempts reached') {
          toast({
            title: 'Maximum Attempts Reached',
            description: data.message,
            variant: 'destructive',
          })
        } else {
          throw new Error(data.error || 'Failed to start test')
        }
        return
      }

      setAttempt(data.attempt)
      setStarted(true)

      // Enter fullscreen if required
      if (test.requireFullscreen) {
        try {
          await document.documentElement.requestFullscreen()
        } catch (error) {
          console.warn('Failed to enter fullscreen:', error)
          toast({
            title: 'Fullscreen Required',
            description: 'Please enable fullscreen mode to take this test',
            variant: 'destructive',
          })
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start test',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const saveAnswer = useCallback(async (questionId: string, answerData: any) => {
    if (!attempt || attempt.status !== 'IN_PROGRESS') return

    try {
      // Ensure markedForReview is included from state if not already in answerData
      const dataToSave = {
        ...answerData,
        markedForReview: answerData.markedForReview !== undefined 
          ? answerData.markedForReview 
          : markedForReview.has(questionId),
      }

      const response = await fetch(`/api/tests/${test.id}/attempts/${attempt.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          ...dataToSave,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save answer')
      }
    } catch (error: any) {
      console.error('Failed to save answer:', error)
      toast({
        title: 'Warning',
        description: error.message || 'Failed to save answer. Please try again.',
        variant: 'destructive',
      })
    }
  }, [attempt, test.id, toast, markedForReview])

  const handleAnswerChange = (questionId: string, answerData: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answerData,
    }))

    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveAnswer(questionId, {
        ...answerData,
        markedForReview: markedForReview.has(questionId),
      })
    }, 1000)
  }

  const handleMarkForReview = (questionId: string, marked: boolean) => {
    const newMarked = new Set(markedForReview)
    if (marked) {
      newMarked.add(questionId)
    } else {
      newMarked.delete(questionId)
    }
    setMarkedForReview(newMarked)

    // Save immediately
    const answerData = answers[questionId] || {}
    saveAnswer(questionId, {
      ...answerData,
      markedForReview: marked,
    })
  }

  // Format time remaining as MM:SS
  const formatTime = (seconds: number): string => {
    if (seconds < 0) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Check if there are unanswered questions - memoized to avoid recalculating on every render
  const unansweredQuestions = useMemo(() => {
    return test.questions.filter((question: any) => {
      // TEXT_BLOCK questions are stored as SHORT_TEXT with 0 points - they don't require answers
      const isTextBlock = question.type === 'SHORT_TEXT' && Number(question.points) === 0
      if (isTextBlock) {
        return false
      }
      const answer = answers[question.id]
      if (!answer) return true
      
      if (question.type === 'MCQ_SINGLE' || question.type === 'MCQ_MULTI') {
        return !answer.selectedOptionIds || answer.selectedOptionIds.length === 0
      } else if (question.type === 'NUMERIC') {
        return answer.numericAnswer === null || answer.numericAnswer === undefined
      } else {
        return !answer.answerText || answer.answerText.trim() === ''
      }
    })
  }, [test.questions, answers])

  const handleSubmit = useCallback(async () => {
    if (!attempt) return

    setSubmitting(true)

    try {
      // Save all pending answers immediately before submitting
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Save all answers that might be pending (wait for them to complete)
      const savePromises = Object.entries(answers).map(([questionId, answerData]) => 
        saveAnswer(questionId, {
          ...answerData,
          markedForReview: markedForReview.has(questionId),
        })
      )
      await Promise.all(savePromises)

      // Small delay to ensure DB writes complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const response = await fetch(`/api/tests/${test.id}/attempts/${attempt.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientFingerprint: await generateClientFingerprint({
            userAgent: navigator.userAgent,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit test')
      }

      toast({
        title: 'Test Submitted',
        description: 'Your answers have been saved successfully',
      })

      // Exit fullscreen before navigating
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen()
        } catch (error) {
          // Ignore fullscreen exit errors
        }
      }

      // Use window.location for full page navigation to ensure tab parameter is preserved
      if (testingPortal) {
        window.location.href = '/testing'
      } else if (tournamentId) {
        window.location.href = `/tournaments/${tournamentId}/tests`
      } else {
        // Extract clubId from membership or current URL path
        const clubId = membership?.clubId || window.location.pathname.split('/')[2]
        window.location.href = `/club/${clubId}?tab=tests`
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit test',
        variant: 'destructive',
      })
      setSubmitting(false)
      // Restore fullscreen on error if required
      if (test.requireFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    }
  }, [attempt, test.id, membership.clubId, test.requireFullscreen, toast, router, answers, saveAnswer, tournamentId, testingPortal])

  // Countdown timer
  useEffect(() => {
    if (!started || !attempt || attempt.status !== 'IN_PROGRESS') {
      setTimeRemaining(null)
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }

    // Calculate initial remaining time
    const calculateRemainingTime = (): number => {
      if (!attempt.startedAt) return test.durationMinutes * 60
      
      const startTime = new Date(attempt.startedAt).getTime()
      const now = Date.now()
      const elapsedSeconds = Math.floor((now - startTime) / 1000)
      // Account for time spent off-page (tab switches)
      // Account for time spent paused (save & exit)
      const adjustedElapsed = elapsedSeconds - (timeOffPageSeconds || 0) - totalPausedSecondsRef.current
      const totalDurationSeconds = test.durationMinutes * 60
      const remaining = Math.max(0, totalDurationSeconds - adjustedElapsed)
      
      return remaining
    }

    // Set initial time
    setTimeRemaining(calculateRemainingTime())

    // Update timer every second
    timerIntervalRef.current = setInterval(() => {
      const remaining = calculateRemainingTime()
      setTimeRemaining(remaining)

      // Auto-submit when time runs out
      if (remaining <= 0 && attempt.status === 'IN_PROGRESS') {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current)
          timerIntervalRef.current = null
        }
        toast({
          title: 'Time Up',
          description: 'Your test is being submitted automatically.',
          variant: 'destructive',
        })
        // Mark that we're intentionally exiting
        isExitingRef.current = true
        handleSubmit()
      }
    }, 1000)

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [started, attempt, test.durationMinutes, timeOffPageSeconds, toast, handleSubmit])

  // Handle browser back button - auto-submit test
  useEffect(() => {
    if (!started || !attempt || attempt.status !== 'IN_PROGRESS') {
      return
    }

    // Push a dummy state to history so we can intercept back button
    const testState = { testId: test.id, attemptId: attempt.id, fromTest: true }
    window.history.pushState(testState, '', window.location.href)

    const handlePopState = (event: PopStateEvent) => {
      // When back button is pressed, push state back immediately to prevent navigation
      // This happens synchronously before the browser navigates away
      window.history.pushState(testState, '', window.location.href)
      
      // Auto-submit the test (only if test is still in progress and not already exiting)
      const currentAttempt = attemptRef.current
      if (!isExitingRef.current && currentAttempt && currentAttempt.status === 'IN_PROGRESS') {
        isExitingRef.current = true
        toast({
          title: 'Test Auto-Submitted',
          description: 'Your test has been submitted due to navigation attempt.',
        })
        handleSubmit().catch((error) => {
          console.error('Failed to auto-submit test:', error)
          isExitingRef.current = false
        })
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [started, attempt, test.id, handleSubmit, toast])

  if (!started) {
    const clubId = membership?.clubId
    
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{test.name}</CardTitle>
              {(clubId || tournamentId || testingPortal) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (testingPortal) {
                      router.push('/testing')
                    } else if (tournamentId) {
                      router.push(`/tournaments/${tournamentId}/tests`)
                    } else if (clubId) {
                      router.push(`/club/${clubId}?tab=tests`)
                    }
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Tests
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {test.description && <p className="text-muted-foreground">{test.description}</p>}
            {test.instructions && (
              <div className="rounded-md bg-muted p-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Instructions</p>
                <p className="text-sm whitespace-pre-wrap">{test.instructions}</p>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Duration: {test.durationMinutes} minutes</span>
            </div>
            {test.maxAttempts && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Maximum attempts: {test.maxAttempts}</span>
              </div>
            )}
            {test.requireFullscreen && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Lock className="h-4 w-4" />
                <span>This test requires fullscreen mode</span>
              </div>
            )}
            {test.allowCalculator && test.calculatorType && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CalcIcon className="h-4 w-4" />
                <span>
                  Calculator allowed: {
                    test.calculatorType === 'FOUR_FUNCTION' ? 'Four Function Calculator' :
                    test.calculatorType === 'SCIENTIFIC' ? 'Scientific Calculator' :
                    'Graphing Calculator'
                  }
                </span>
              </div>
            )}
            {test.testPasswordHash && !isAdmin && (
              <div>
                <Label htmlFor="password">Test Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError('')
                  }}
                  placeholder="Enter password to start"
                />
                {passwordError && (
                  <p className="text-sm text-red-600 mt-1">{passwordError}</p>
                )}
              </div>
            )}
            <Button onClick={handleStartTest} disabled={loading} className="w-full">
              {loading && <ButtonLoading />}
              {loading ? 'Starting...' : 'Start Test'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show fullscreen prompt if needed (for resume)
  if (needsFullscreenPrompt && started && test.requireFullscreen) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Resume Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              This test requires fullscreen mode. Click the button below to continue.
            </p>
            <Button onClick={handleEnterFullscreen} className="w-full" size="lg">
              <Lock className="h-4 w-4 mr-2" />
              Enter Fullscreen to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background grid-pattern">
      {/* Sticky header with test info and timer */}
      <div className="sticky top-0 z-40 bg-background border-b backdrop-blur-sm bg-background/95">
        <div className="container mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold truncate">{test.name}</h1>
              {tabSwitchCount > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Tab switches: {tabSwitchCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              {test.allowNoteSheet && <NoteSheetViewer testId={test.id} />}
              {test.allowCalculator && test.calculatorType && (
                <CalculatorButton calculatorType={test.calculatorType} />
              )}
              {timeRemaining !== null ? (
                <span className={`font-mono font-semibold ${
                  timeRemaining <= 60 ? 'text-red-600 dark:text-red-400' : 
                  timeRemaining <= 300 ? 'text-amber-600 dark:text-amber-400' : 
                  'text-foreground'
                }`}>
                  <Clock className="inline h-4 w-4 mr-1" />
                  {formatTime(timeRemaining)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  <Clock className="inline h-4 w-4 mr-1" />
                  {test.durationMinutes} min
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 container mx-auto max-w-6xl px-4 py-6">
        <Card>
          <CardContent className="pt-6">
          <div className="space-y-6">
            {test.questions.length === 0 ? (
              <p className="text-muted-foreground">No questions available.</p>
            ) : (
              test.questions.map((question: any, index: number) => {
                // TEXT_BLOCK questions are stored as SHORT_TEXT with 0 points
                const isTextBlock = question.type === 'SHORT_TEXT' && Number(question.points) === 0
                
                return (
                <div key={question.id} className={`space-y-3 p-4 border rounded-lg ${markedForReview.has(question.id) ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">Question {index + 1}</span>
                      <Badge variant="outline" className="text-xs">
                        {(() => {
                          // Check if it's a text block
                          if (isTextBlock) {
                            return 'Text Block'
                          }
                          
                          // Check if SHORT_TEXT is actually a fill-in-the-blank
                          const promptText = question.promptMd || ''
                          const isFillBlank = question.type === 'SHORT_TEXT' && /\[blank\d*\]/.test(promptText)
                          
                          if (question.type === 'MCQ_SINGLE') {
                            // Check if it's True/False
                            if (question.options && question.options.length === 2) {
                              const optionLabels = question.options.map((opt: any) => opt.label.trim().toLowerCase())
                              if (optionLabels.includes('true') && optionLabels.includes('false')) {
                                return 'True or False'
                              }
                            }
                            return 'Multiple Choice'
                          } else if (question.type === 'MCQ_MULTI') {
                            return 'Select All That Apply'
                          } else if (question.type === 'LONG_TEXT') {
                            return 'Free Response'
                          } else if (isFillBlank) {
                            return 'Fill in the Blank'
                          } else if (question.type === 'SHORT_TEXT') {
                            return 'Short Answer'
                          } else if (question.type === 'NUMERIC') {
                            return 'Numeric'
                          } else {
                            return question.type.replace('MCQ_', '').replace('_', ' ')
                          }
                        })()}
                      </Badge>
                      {!isTextBlock && (
                        <span className="text-sm text-muted-foreground">
                          ({question.points} points)
                        </span>
                      )}
                      {markedForReview.has(question.id) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 font-medium">
                          Marked for Review
                        </span>
                      )}
                    </div>
                    {!isTextBlock && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkForReview(question.id, !markedForReview.has(question.id))}
                        disabled={submitting}
                        className={`flex items-center gap-2 h-8 ${
                          markedForReview.has(question.id)
                            ? 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Flag
                          className={`h-4 w-4 ${
                            markedForReview.has(question.id) ? 'fill-current' : ''
                          }`}
                        />
                        <span className="text-sm">
                          {markedForReview.has(question.id) ? 'Marked for review' : 'Mark for review'}
                        </span>
                      </Button>
                    )}
                  </div>
                  {isTextBlock ? (
                    <QuestionPrompt promptMd={question.promptMd} />
                  ) : question.type === 'SHORT_TEXT' && (() => {
                    // Check if this is a fill-in-the-blank question (contains blank markers: [blank] or [blank1], [blank2], etc.)
                    const promptText = question.promptMd || ''
                    const hasBlanks = /\[blank\d*\]/.test(promptText)
                    
                    if (hasBlanks) {
                      // Parse the prompt to extract context and prompt sections
                      const parts = promptText.split('---')
                      const contextSection = parts.length > 1 ? parts[0].trim() : ''
                      const promptSection = parts.length > 1 ? parts[1].trim() : promptText.trim()
                      
                      // Extract just the text content (remove image and table markdown temporarily)
                      // We'll render images/tables separately using QuestionPrompt
                      const imageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g
                      const tableRegex = /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|(?:\r?\n(?!\r?\n))?)+)/g
                      
                      // Store images and tables to render separately
                      const imagesAndTables: string[] = []
                      let textOnly = promptSection
                      
                      // Extract images
                      let match
                      const imageMatches: string[] = []
                      while ((match = imageRegex.exec(promptSection)) !== null) {
                        imageMatches.push(match[0])
                      }
                      
                      // Extract tables
                      const tableMatches: string[] = []
                      while ((match = tableRegex.exec(promptSection)) !== null) {
                        tableMatches.push(match[0])
                      }
                      
                      // Remove images and tables from text for blank processing
                      textOnly = textOnly.replace(imageRegex, '')
                      textOnly = textOnly.replace(tableRegex, '')
                      
                      // Split on blank markers ([blank], [blank1], [blank2], etc.) to get text segments
                      // First normalize all blank markers to a placeholder, then split
                      const normalizedText = textOnly.replace(/\[blank\d*\]/g, '[BLANK_MARKER]')
                      const textSegments: string[] = normalizedText.split('[BLANK_MARKER]')
                      const blankCount = textSegments.length - 1
                      
                      // Initialize blank answers if not present
                      const blankAnswers = answers[question.id]?.blankAnswers || Array(blankCount).fill('')
                      
                      return (
                        <div className="space-y-4">
                          {/* Render context if exists */}
                          {contextSection && (
                            <div className="pb-3 border-b border-border">
                              <QuestionPrompt promptMd={contextSection} />
                            </div>
                          )}
                          
                          {/* Render prompt text with inline blanks */}
                          <div className="text-base leading-relaxed">
                            {textSegments.map((segment, index) => (
                              <span key={index} className="inline">
                                {segment && (
                                  <span className="whitespace-pre-wrap">{segment}</span>
                                )}
                                {index < textSegments.length - 1 && (
                                  <Input
                                    type="text"
                                    placeholder=""
                                    value={blankAnswers[index] || ''}
                                    onChange={(e) => {
                                      const newBlankAnswers = [...blankAnswers]
                                      newBlankAnswers[index] = e.target.value
                                      handleAnswerChange(question.id, {
                                        blankAnswers: newBlankAnswers,
                                        answerText: newBlankAnswers.join(' | '), // Store as delimited string for compatibility
                                      })
                                    }}
                                    disabled={submitting}
                                    className="inline-block w-auto min-w-[150px] max-w-[300px] mx-2 align-middle"
                                  />
                                )}
                              </span>
                            ))}
                          </div>
                          
                          {/* Render images separately if they exist (before the text) */}
                          {imageMatches.length > 0 && (
                            <div className="mb-4">
                              {imageMatches.map((img, idx) => (
                                <div key={`img-${idx}`} className="my-3 rounded-md border border-input overflow-hidden bg-muted/30">
                                  <img
                                    src={img.match(/\(([^)]+)\)/)?.[1] || ''}
                                    alt={img.match(/\[([^\]]*)\]/)?.[1] || 'Image'}
                                    className="max-w-full max-h-96 object-contain block mx-auto"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Render tables separately if they exist (after the text) */}
                          {tableMatches.length > 0 && (
                            <div className="mt-4">
                              {tableMatches.map((table, idx) => (
                                <div key={`table-${idx}`} className="my-3">
                                  <QuestionPrompt promptMd={table} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
                    
                    // Regular short text question - render normally
                    return (
                      <>
                        <QuestionPrompt promptMd={question.promptMd} />
                        <Input
                          type="text"
                          placeholder="Enter your answer"
                          value={answers[question.id]?.answerText ?? ''}
                          onChange={(e) => handleAnswerChange(question.id, {
                            answerText: e.target.value,
                          })}
                          disabled={submitting}
                        />
                      </>
                    )
                  })()}
                  
                  {question.type !== 'SHORT_TEXT' && question.type !== 'LONG_TEXT' && !isTextBlock && <QuestionPrompt promptMd={question.promptMd} />}
                  {question.type === 'LONG_TEXT' && !isTextBlock && (() => {
                    // For LONG_TEXT, we'll render the prompt inside the answer section if it has FRQ parts
                    // Otherwise render it here
                    const promptMd = question.promptMd || ''
                    const frqPartsMatch = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)
                    if (!frqPartsMatch) {
                      // No FRQ parts, render normally
                      return <QuestionPrompt promptMd={question.promptMd} />
                    }
                    // FRQ parts will be rendered in the answer section, so don't render here
                    return null
                  })()}
                  
                  {!isTextBlock && question.type === 'MCQ_SINGLE' && (
                    <RadioGroup 
                      value={answers[question.id]?.selectedOptionIds?.[0] || ''} 
                      onValueChange={(value) => handleAnswerChange(question.id, {
                        selectedOptionIds: [value],
                      })}
                      disabled={submitting}
                      className="space-y-2"
                    >
                      {question.options.map((option: any) => (
                        <div
                          key={option.id}
                          className={`flex items-center gap-2 p-3 rounded border ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted'}`}
                        >
                          <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} disabled={submitting} />
                          <Label htmlFor={`${question.id}-${option.id}`} className={`${submitting ? 'cursor-not-allowed' : 'cursor-pointer'} font-normal flex-1`}>
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {!isTextBlock && question.type === 'MCQ_MULTI' && (
                    <div className="space-y-2">
                      {question.options.map((option: any) => (
                        <div
                          key={option.id}
                          className={`flex items-center gap-2 p-3 rounded border ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted'}`}
                        >
                          <Checkbox
                            id={`${question.id}-${option.id}`}
                            checked={answers[question.id]?.selectedOptionIds?.includes(option.id) || false}
                            onCheckedChange={(checked) => {
                              const current = answers[question.id]?.selectedOptionIds || []
                              const newSelected = checked
                                ? [...current, option.id]
                                : current.filter((id: string) => id !== option.id)
                              handleAnswerChange(question.id, {
                                selectedOptionIds: newSelected,
                              })
                            }}
                            disabled={submitting}
                          />
                          <Label htmlFor={`${question.id}-${option.id}`} className={`${submitting ? 'cursor-not-allowed' : 'cursor-pointer'} font-normal flex-1`}>
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isTextBlock && question.type === 'NUMERIC' && (
                    <Input
                      type="number"
                      step="any"
                      placeholder="Enter numeric answer"
                      value={answers[question.id]?.numericAnswer ?? ''}
                      onChange={(e) => handleAnswerChange(question.id, {
                        numericAnswer: e.target.value ? parseFloat(e.target.value) : null,
                      })}
                      disabled={submitting}
                    />
                  )}

                  {!isTextBlock && question.type === 'LONG_TEXT' && (() => {
                    // Parse FRQ parts from promptMd if they exist
                    const promptMd = question.promptMd || ''
                    const frqPartsMatch = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)
                    
                    if (frqPartsMatch) {
                      // Extract main content (everything before ---FRQ_PARTS---)
                      const mainContent = promptMd.substring(0, frqPartsMatch.index).trim()
                      const partsText = frqPartsMatch[1]
                      
                      // Parse context and prompt from main content (split on ---)
                      const parts = mainContent.split('---').map((p: string) => p.trim()).filter((p: string) => p)
                      const contextSection = parts.length > 1 ? parts[0] : ''
                      const promptSection = parts.length > 1 ? parts[1] : mainContent
                      
                      // Parse individual parts using regex: [PART:label:points]\nprompt text
                      const partRegex = /\[PART:([a-z]):(\d+(?:\.\d+)?)\]\n([\s\S]*?)(?=\n\n\[PART:|$)/g
                      const frqParts: Array<{ label: string; points: number; prompt: string }> = []
                      let match
                      
                      while ((match = partRegex.exec(partsText)) !== null) {
                        frqParts.push({
                          label: match[1],
                          points: parseFloat(match[2]),
                          prompt: match[3].trim(),
                        })
                      }
                      
                      if (frqParts.length > 0) {
                        // Parse existing answers for FRQ parts (stored as delimited string: "part1 | part2 | part3")
                        const existingAnswer = answers[question.id]?.answerText || ''
                        const partAnswers = existingAnswer ? existingAnswer.split(' | ') : Array(frqParts.length).fill('')
                        
                        // Ensure we have enough answer slots
                        while (partAnswers.length < frqParts.length) {
                          partAnswers.push('')
                        }
                        
                        return (
                          <div className="space-y-4">
                            {/* Render context if exists */}
                            {contextSection && (
                              <div className="pb-3 border-b border-border">
                                <p className="text-xs text-muted-foreground mb-1">Context/Stimulus</p>
                                <QuestionPrompt promptMd={contextSection} />
                              </div>
                            )}
                            
                            {/* Render main prompt if exists (and different from context) */}
                            {promptSection && promptSection !== contextSection && (
                              <div className="pb-3 border-b border-border">
                                <QuestionPrompt promptMd={promptSection} />
                              </div>
                            )}
                            
                            {/* Render each FRQ part */}
                            <div className="space-y-4">
                              {frqParts.map((part, partIdx) => (
                                <div key={partIdx} className="border-l-2 border-primary pl-4">
                                  <p className="text-sm font-semibold mb-2">
                                    Part {part.label}) ({part.points} points)
                                  </p>
                                  <p className="text-sm mb-2 whitespace-pre-wrap">{part.prompt}</p>
                                  <Textarea
                                    className="min-h-[100px]"
                                    placeholder="Student will type their answer here..."
                                    value={partAnswers[partIdx] || ''}
                                    onChange={(e) => {
                                      const newPartAnswers = [...partAnswers]
                                      newPartAnswers[partIdx] = e.target.value
                                      handleAnswerChange(question.id, {
                                        answerText: newPartAnswers.join(' | '), // Store as delimited string
                                      })
                                    }}
                                    disabled={submitting}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                    }
                    
                    // Fallback to single textarea for regular LONG_TEXT questions
                    return (
                      <Textarea
                        className="min-h-[150px]"
                        placeholder="Enter your answer"
                        value={answers[question.id]?.answerText ?? ''}
                        onChange={(e) => handleAnswerChange(question.id, {
                          answerText: e.target.value,
                        })}
                        disabled={submitting}
                      />
                    )
                  })()}
                </div>
              )})
            )}
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed bottom bar with submit actions */}
      <div className="sticky bottom-0 z-40 border-t bg-background backdrop-blur-sm bg-background/95">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {(markedForReview.size > 0 || unansweredQuestions.length > 0) && (
                <div className="text-sm text-amber-600 dark:text-amber-400">
                  {markedForReview.size > 0 && (
                    <span>{markedForReview.size} marked for review</span>
                  )}
                  {markedForReview.size > 0 && unansweredQuestions.length > 0 && <span> • </span>}
                  {unansweredQuestions.length > 0 && (
                    <span>{unansweredQuestions.length} unanswered</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {((test as any).requireOneSitting === false) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveExitDialog(true)
                  }}
                  disabled={submitting}
                >
                  Save & Exit
                </Button>
              )}
              <Button
                onClick={() => {
                  setShowSubmitDialog(true)
                }}
                disabled={submitting}
                size="lg"
              >
                {submitting && <ButtonLoading />}
                {submitting ? 'Submitting...' : 'Submit Test'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Save & Exit Confirmation Dialog */}
      <Dialog open={showSaveExitDialog} onOpenChange={(open) => {
        setShowSaveExitDialog(open)
        if (!open) {
          // User canceled - restore fullscreen if required
          if (test.requireFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {})
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save and Exit?</DialogTitle>
            <DialogDescription>
              Are you sure you want to save and exit? Your progress will be saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveExitDialog(false)
                // User canceled - restore fullscreen if required
                if (test.requireFullscreen && !document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {})
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Mark that we're intentionally exiting
                isExitingRef.current = true
                
                // Save all pending answers before exiting
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current)
                }
                
                // Save all answers that might be pending
                const savePromises = Object.entries(answers).map(([questionId, answerData]) => 
                  saveAnswer(questionId, {
                    ...answerData,
                    markedForReview: markedForReview.has(questionId),
                  })
                )
                await Promise.all(savePromises)
                
                // Pause the timer - store the current timestamp
                if (attempt && attempt.startedAt) {
                  pausedAtRef.current = Date.now()
                  // Store in localStorage so we can resume later
                  localStorage.setItem(`test_paused_${attempt.id}`, pausedAtRef.current.toString())
                }
                
                // Exit fullscreen before navigating
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {})
                }
                
                // Navigate away - fullscreen will NOT be re-entered
                setShowSaveExitDialog(false)
                // Use window.location for full page navigation to ensure tab parameter is preserved
                // Extract clubId from membership or current URL path
                const clubId = membership?.clubId || window.location.pathname.split('/')[2]
                window.location.href = `/club/${clubId}?tab=tests`
              }}
            >
              Save & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={(open) => {
        setShowSubmitDialog(open)
        if (!open) {
          // User canceled - restore fullscreen if required
          if (test.requireFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {})
          }
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Test?</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit? You cannot change your answers after submitting.
            </DialogDescription>
          </DialogHeader>
          {(markedForReview.size > 0 || unansweredQuestions.length > 0) && (
            <div className="space-y-2 py-2">
              {markedForReview.size > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      You have {markedForReview.size} question{markedForReview.size !== 1 ? 's' : ''} marked for review.
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-1">
                      Make sure you&apos;ve reviewed these questions before submitting.
                    </p>
                  </div>
                </div>
              )}
              {unansweredQuestions.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      You have {unansweredQuestions.length} unanswered question{unansweredQuestions.length !== 1 ? 's' : ''}.
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-1">
                      You can still submit, but these questions will receive no points.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSubmitDialog(false)
                // User canceled - restore fullscreen if required
                if (test.requireFullscreen && !document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {})
                }
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Mark that we're intentionally exiting
                isExitingRef.current = true
                setShowSubmitDialog(false)
                await handleSubmit()
              }}
              disabled={submitting}
            >
              {submitting && <ButtonLoading />}
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
