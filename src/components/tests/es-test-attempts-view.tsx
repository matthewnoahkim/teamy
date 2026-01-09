'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { Users, Eye, AlertTriangle, CheckCircle, XCircle, Clock, Info, Save, Sparkles, Loader2, Send } from 'lucide-react'
import { QuestionPrompt } from '@/components/tests/question-prompt'

interface ESTestAttemptsViewProps {
  testId: string
  testName: string
  scoresReleased: boolean
  onScoresReleased?: () => void
}

interface Attempt {
  id: string
  membershipId: string
  status: string
  startedAt: string | null
  submittedAt: string | null
  gradeEarned: number | null
  proctoringScore: number | null
  tabSwitchCount: number
  timeOffPageSeconds: number
  user: {
    id: string
    name: string | null
    email: string
  } | null
  club: {
    id: string
    name: string
  } | null
  proctorEvents: Array<{
    id: string
    kind: string
    ts: string
    meta: any
  }>
  answers: Array<{
    id: string
    questionId: string
    answerText: string | null
    selectedOptionIds: string[] | null
    numericAnswer: number | null
    pointsAwarded: number | null
    gradedAt: string | null
    graderNote: string | null
    question: {
      id: string
      promptMd: string
      type: string
      points: number
      sectionId: string | null
      explanation: string | null
      options: Array<{
        id: string
        label: string
        isCorrect: boolean
      }>
    }
  }>
}

interface GradeEdit {
  answerId: string
  pointsAwarded: number | null // null = not graded
  graderNote: string
  partPoints?: (number | null)[] // For multipart FRQs
}

interface Section {
  id: string
  title: string | null
}

export function ESTestAttemptsView({ testId, testName, scoresReleased: initialScoresReleased, onScoresReleased }: ESTestAttemptsViewProps) {
  const { toast } = useToast()
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [scoringKeyOpen, setScoringKeyOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'submission' | 'score'>('submission')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [gradeEdits, setGradeEdits] = useState<Record<string, GradeEdit>>({})
  const [saving, setSaving] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, any>>({})
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false)
  const [requestingAiGrading, setRequestingAiGrading] = useState<string | null>(null) // Track which part is loading: `${answerId}-${partIndex}` or `answerId` for whole question
  const [scoresReleased, setScoresReleased] = useState(initialScoresReleased)
  const [releasingScores, setReleasingScores] = useState(false)

  useEffect(() => {
    fetchAttempts()
  }, [testId])

  const fetchAttempts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/es/tests/${testId}/attempts`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch attempts`)
      }
      const data = await response.json()
      setAttempts(data.attempts || [])
      setSections(data.sections || [])
    } catch (error: any) {
      console.error('Failed to fetch attempts:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load test attempts',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = async (attempt: Attempt) => {
    setSelectedAttempt(attempt)
    setDetailDialogOpen(true)
    // Initialize grade edits from current attempt
    const edits: Record<string, GradeEdit> = {}
    attempt.answers.forEach((answer) => {
      // Try to parse part points from graderNote if it exists
      let partPoints: (number | null)[] | undefined = undefined
      let graderNoteText = answer.graderNote || ''
      
      if (answer.graderNote) {
        try {
          // Check if graderNote contains JSON with partPoints
          const parsed = JSON.parse(answer.graderNote)
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.partPoints)) {
            partPoints = parsed.partPoints
            graderNoteText = parsed.feedback || ''
          }
        } catch {
          // If parsing fails, treat as plain text feedback
          graderNoteText = answer.graderNote
        }
      }
      
      // If no partPoints were loaded but this is a multipart FRQ, initialize them
      if (!partPoints && (answer.question.type === 'LONG_TEXT' || answer.question.type === 'SHORT_TEXT')) {
        const promptMd = answer.question.promptMd || ''
        const frqPartsMatch = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)
        if (frqPartsMatch) {
          const partsText = frqPartsMatch[1]
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
            // Initialize partPoints array with nulls, or distribute pointsAwarded if it exists
            if (answer.pointsAwarded !== null && answer.pointsAwarded > 0) {
              // If there's an existing total, try to distribute it proportionally
              // Otherwise, just initialize with nulls
              partPoints = Array(frqParts.length).fill(null)
            } else {
              partPoints = Array(frqParts.length).fill(null)
            }
          }
        }
      }
      
      edits[answer.id] = {
        answerId: answer.id,
        // Only set pointsAwarded if it's been graded (gradedAt is not null)
        // If never graded, keep as null (empty field, shows as ungraded)
        pointsAwarded: answer.gradedAt !== null && answer.pointsAwarded !== null && answer.pointsAwarded !== undefined 
          ? answer.pointsAwarded 
          : null,
        graderNote: graderNoteText,
        partPoints,
      }
    })
    setGradeEdits(edits)
    // Fetch AI suggestions for this attempt
    await fetchAiSuggestions(attempt.id)
  }

  const fetchAiSuggestions = async (attemptId: string) => {
    setLoadingAiSuggestions(true)
    try {
      const response = await fetch(`/api/es/tests/${testId}/attempts/${attemptId}/ai/suggestions`)
      if (response.ok) {
        const data = await response.json()
        // Create a map of answerId -> suggestion
        const suggestionsMap: Record<string, any> = {}
        data.suggestions?.forEach((suggestion: any) => {
          // Parse part suggestions from rawResponse if present
          if (suggestion.rawResponse?.isMultipart && suggestion.rawResponse?.partSuggestions) {
            suggestion.partSuggestions = suggestion.rawResponse.partSuggestions
          }
          suggestionsMap[suggestion.answerId] = suggestion
        })
        setAiSuggestions(suggestionsMap)
      }
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error)
      // Don't show error toast, just silently fail
    } finally {
      setLoadingAiSuggestions(false)
    }
  }

  const handleRequestAiGrading = async (mode: 'single' | 'all', answerId?: string, partIndex?: number) => {
    if (!selectedAttempt) return

    // Set loading key for the specific part or question
    const loadingKey = partIndex !== undefined && answerId ? `${answerId}-${partIndex}` : (answerId || 'all')
    setRequestingAiGrading(loadingKey)
    
    try {
      const response = await fetch(`/api/es/tests/${testId}/attempts/${selectedAttempt.id}/ai/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, answerId, partIndex }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to request AI grading')
      }

      const data = await response.json()
      
      // Update suggestions map with new suggestions
      const updatedSuggestions = { ...aiSuggestions }
      data.suggestions?.forEach((suggestion: any) => {
        // Parse part suggestions from rawResponse if present
        if (suggestion.rawResponse?.isMultipart && suggestion.rawResponse?.partSuggestions) {
          suggestion.partSuggestions = suggestion.rawResponse.partSuggestions
        }
        updatedSuggestions[suggestion.answerId] = suggestion
      })
      setAiSuggestions(updatedSuggestions)

      toast({
        title: 'Success',
        description: `AI grading suggestions generated for ${data.suggestions?.length || 0} question(s)`,
      })
    } catch (error: any) {
      console.error('Failed to request AI grading:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to request AI grading',
        variant: 'destructive',
      })
    } finally {
      setRequestingAiGrading(null)
    }
  }

  const handleApplyAiSuggestion = (answerId: string) => {
    const suggestion = aiSuggestions[answerId]
    if (!suggestion) return

    setGradeEdits((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        pointsAwarded: suggestion.suggestedPoints,
        graderNote: suggestion.explanation || prev[answerId]?.graderNote || '',
      },
    }))
  }

  const handleGradeEdit = (answerId: string, field: 'pointsAwarded' | 'graderNote', value: number | string) => {
    setGradeEdits((prev) => {
      const newValue = field === 'pointsAwarded' 
        ? (value === '' || value === null || value === undefined ? null : (typeof value === 'string' ? (value.trim() === '' ? null : parseFloat(value)) : value))
        : value
      
      return {
      ...prev,
      [answerId]: {
        ...prev[answerId],
          [field]: newValue,
          // Reset partPoints if manually editing total points (not from parts)
          ...(field === 'pointsAwarded' && !prev[answerId]?.partPoints ? {} : {}),
        },
      }
    })
  }

  const handlePartGradeEdit = (answerId: string, partIndex: number, value: number | string, maxPoints: number) => {
    setGradeEdits((prev) => {
      const current = prev[answerId] || { answerId, pointsAwarded: null, graderNote: '' }
      const partPoints = current.partPoints || []
      const newPartPoints = [...partPoints]
      
      // Ensure array is long enough
      while (newPartPoints.length <= partIndex) {
        newPartPoints.push(null)
      }
      
      // Handle value: empty string or null = not graded
      let clampedValue: number | null = null
      if (value !== '' && value !== null && value !== undefined) {
        const numValue = typeof value === 'string' 
          ? (value.trim() === '' ? NaN : parseFloat(value))
          : value
        if (!isNaN(numValue) && isFinite(numValue)) {
          clampedValue = Math.min(Math.max(0, numValue), maxPoints)
        }
      }
      
      newPartPoints[partIndex] = clampedValue
      
      // Calculate total from part points - only if at least one part is graded
      const hasAnyGradedPart = newPartPoints.some(pts => pts !== null && pts !== undefined)
      const totalPoints = hasAnyGradedPart 
        ? newPartPoints.reduce((sum: number, pts) => sum + (pts || 0), 0)
        : null
      
      return {
        ...prev,
        [answerId]: {
          ...current,
          partPoints: newPartPoints,
          pointsAwarded: totalPoints,
        },
      }
    })
  }

  const handleSaveGrades = async () => {
    if (!selectedAttempt) return

    setSaving(true)
    try {
      // Save all grades that have been edited, including ones to be cleared (ungraded)
      // This includes:
      // 1. Grades explicitly set (not null) - including 0 (explicitly graded as 0)
      // 2. Previously graded answers that are now cleared (null) - to ungrade them
      const gradesToSave = Object.values(gradeEdits)
        .filter((grade) => {
        const answer = selectedAttempt.answers.find((a) => a.id === grade.answerId)
          if (!answer) return false
          
          // For multipart FRQs, check if any part has been graded OR if it was previously graded and is now cleared
          if (grade.partPoints && grade.partPoints.length > 0) {
            const hasAnyGradedPart = grade.partPoints.some(pts => pts !== null && pts !== undefined)
            const wasPreviouslyGraded = answer.gradedAt !== null
            // Include if has graded parts, or was graded but is now cleared (all parts null)
            return hasAnyGradedPart || (wasPreviouslyGraded && !hasAnyGradedPart)
          }
          
          // For single-part, include if:
          // - pointsAwarded is explicitly set (not null), OR
          // - it was previously graded but is now cleared (null)
          const wasPreviouslyGraded = answer.gradedAt !== null
          const isNowCleared = grade.pointsAwarded === null || grade.pointsAwarded === undefined
          return (grade.pointsAwarded !== null && grade.pointsAwarded !== undefined) || (wasPreviouslyGraded && isNowCleared)
        })
        .map((grade) => {
          const answer = selectedAttempt.answers.find((a) => a.id === grade.answerId)!
          
          // For multipart FRQs, store part points in graderNote as JSON
          let graderNote = grade.graderNote || ''
          
          if (grade.partPoints && grade.partPoints.length > 0) {
            // Store part points and feedback together in JSON format
            const noteData: { partPoints: (number | null)[], feedback?: string } = {
              partPoints: grade.partPoints,
            }
            if (graderNote.trim()) {
              noteData.feedback = graderNote
            }
            graderNote = JSON.stringify(noteData)
          }
          
          // Calculate total for multipart, or use single value
          let pointsAwarded: number | null = null
          if (grade.partPoints && grade.partPoints.length > 0) {
            // For multipart, sum the part points (null if all are null)
            const hasAnyGradedPart = grade.partPoints.some(pts => pts !== null && pts !== undefined)
            if (hasAnyGradedPart) {
              pointsAwarded = grade.partPoints.reduce((sum: number, pts) => sum + (pts || 0), 0)
            }
            // If all parts are null, pointsAwarded stays null (to ungrade)
          } else {
            pointsAwarded = grade.pointsAwarded ?? null
          }
          
          return {
            answerId: grade.answerId,
            pointsAwarded, // Can be null to indicate "ungrade"
            graderNote,
          }
      })

      const response = await fetch(`/api/es/tests/${testId}/attempts/${selectedAttempt.id}/grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades: gradesToSave }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save grades')
      }

      toast({
        title: 'Success',
        description: 'Grades saved successfully',
      })

      // Refresh attempts to get updated data
      await fetchAttempts()
      setDetailDialogOpen(false)
    } catch (error: any) {
      console.error('Failed to save grades:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to save grades',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReleaseScores = async () => {
    setReleasingScores(true)
    try {
      const response = await fetch(`/api/es/tests/${testId}/release-scores`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to release scores'
        // If it's a 400 error about tournament not ended, show a clearer message
        if (response.status === 400 && errorMessage.includes('tournament has ended')) {
          throw new Error('Scores can only be released after the tournament has ended.')
        }
        throw new Error(errorMessage)
      }

      setScoresReleased(true)
      toast({
        title: 'Success',
        description: 'Scores released successfully',
      })

      if (onScoresReleased) {
        onScoresReleased()
      }
    } catch (error: any) {
      console.error('Failed to release scores:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to release scores',
        variant: 'destructive',
      })
    } finally {
      setReleasingScores(false)
    }
  }

  const calculateGradingStatus = (attempt: Attempt): {
    status: 'UNGRADED' | 'PARTIALLY_GRADED' | 'FULLY_GRADED'
    gradedCount: number
    totalCount: number
  } => {
    const totalCount = attempt.answers.length
    
    // Check each answer to see if it's fully graded
    // For multipart FRQs, check if all parts are graded
    let fullyGradedCount = 0
    let partiallyGradedCount = 0
    
    attempt.answers.forEach((answer) => {
      const isFreeResponse = answer.question.type === 'LONG_TEXT' || answer.question.type === 'SHORT_TEXT'
      
      if (isFreeResponse) {
        // Check if it's a multipart FRQ
        const promptMd = answer.question.promptMd || ''
        const isMultipart = promptMd.includes('---FRQ_PARTS---')
        
        if (isMultipart && answer.graderNote && answer.gradedAt !== null) {
          // Parse partPoints from graderNote to check if all parts are graded
          try {
            const parsed = JSON.parse(answer.graderNote)
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.partPoints)) {
              const partPoints = parsed.partPoints
              
              // Extract expected number of parts from promptMd
              const partsText = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)?.[1]
              if (partsText) {
                const partRegex = /\[PART:([a-z]):(\d+(?:\.\d+)?)\]\n([\s\S]*?)(?=\n\n\[PART:|$)/g
                const expectedParts: any[] = []
                let match
                while ((match = partRegex.exec(partsText)) !== null) {
                  expectedParts.push(match[1])
                }
                
                // Check if all expected parts are graded
                if (expectedParts.length > 0) {
                  const allPartsGraded = expectedParts.every((_, index) => {
                    return partPoints[index] !== null && partPoints[index] !== undefined
                  })
                  if (allPartsGraded) {
                    fullyGradedCount++
                  } else {
                    partiallyGradedCount++
                  }
                  return
                }
              }
            }
          } catch {
            // If parsing fails, treat as single-part
          }
        }
        
        // Single-part FRQ: check if gradedAt is set
        if (answer.gradedAt !== null) {
          fullyGradedCount++
        }
      } else {
        // Auto-graded questions
        if (answer.gradedAt !== null || (
          answer.selectedOptionIds !== null || 
          answer.numericAnswer !== null ||
          answer.answerText !== null
        )) {
          fullyGradedCount++
        }
      }
    })

    let status: 'UNGRADED' | 'PARTIALLY_GRADED' | 'FULLY_GRADED'
    if (fullyGradedCount === 0 && partiallyGradedCount === 0) {
      status = 'UNGRADED'
    } else if (fullyGradedCount === totalCount && partiallyGradedCount === 0) {
      status = 'FULLY_GRADED'
    } else {
      status = 'PARTIALLY_GRADED'
    }

    return { status, gradedCount: fullyGradedCount + partiallyGradedCount, totalCount }
  }

  const calculateScoreBreakdown = (attempt: Attempt): {
    earnedPoints: number
    gradedTotalPoints: number
    overallTotalPoints: number
  } => {
    let earnedPoints = 0
    let gradedTotalPoints = 0
    let overallTotalPoints = 0

    attempt.answers.forEach((answer) => {
      const questionPoints = answer.question.points
      overallTotalPoints += questionPoints

      if (answer.gradedAt !== null) {
        gradedTotalPoints += questionPoints
        earnedPoints += answer.pointsAwarded || 0
      }
    })

    return { earnedPoints, gradedTotalPoints, overallTotalPoints }
  }

  const getGradingStatusBadge = (status: 'UNGRADED' | 'PARTIALLY_GRADED' | 'FULLY_GRADED') => {
    const config = {
      UNGRADED: { label: 'Ungraded', variant: 'secondary' as const, className: 'bg-gray-500' },
      PARTIALLY_GRADED: { label: 'Partially Graded', variant: 'default' as const, className: 'bg-orange-500' },
      FULLY_GRADED: { label: 'Fully Graded', variant: 'default' as const, className: 'bg-green-600' },
    }
    const { label, variant, className } = config[status]
    return <Badge variant={variant} className={className}>{label}</Badge>
  }

  const calculateTimeTaken = (startedAt: string | null, submittedAt: string | null): string => {
    if (!startedAt || !submittedAt) return 'N/A'
    
    const start = new Date(startedAt).getTime()
    const end = new Date(submittedAt).getTime()
    const diffMs = end - start
    const diffMins = Math.floor(diffMs / 60000)
    const diffSecs = Math.floor((diffMs % 60000) / 1000)
    
    return `${diffMins}m ${diffSecs}s`
  }

  // Sort attempts based on selected criteria
  const sortedAttempts = [...attempts].sort((a, b) => {
    if (sortBy === 'submission') {
      // Sort by submission date
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
      return sortDirection === 'desc' ? dateB - dateA : dateA - dateB
    } else {
      // Sort by score
      const scoreA = a.gradeEarned ?? -1
      const scoreB = b.gradeEarned ?? -1
      return sortDirection === 'desc' ? scoreB - scoreA : scoreA - scoreB
    }
  })

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      NOT_STARTED: { label: 'Not Started', variant: 'secondary' },
      IN_PROGRESS: { label: 'In Progress', variant: 'default' },
      SUBMITTED: { label: 'Submitted', variant: 'default' },
      GRADED: { label: 'Graded', variant: 'default' },
      INVALIDATED: { label: 'Invalidated', variant: 'destructive' },
    }
    const { label, variant } = config[status] || { label: status, variant: 'secondary' as const }
    return <Badge variant={variant}>{label}</Badge>
  }

  const getProctoringBadge = (score: number | null) => {
    if (score === null) return null
    if (score >= 75) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          High Risk ({score})
        </Badge>
      )
    }
    if (score >= 40) {
      return (
        <Badge variant="default" className="gap-1 bg-orange-500">
          <AlertTriangle className="h-3 w-3" />
          Medium Risk ({score})
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Low Risk ({score})
      </Badge>
    )
  }

  if (loading) {
    return <div className="p-4">Loading attempts...</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Responses ({attempts.length})
              </CardTitle>
              <CardDescription>
                View all student attempts for {testName}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2">
                <label htmlFor="sortBy" className="text-sm text-muted-foreground">
                  Sort by:
                </label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'submission' | 'score')}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="submission">Submission Date</option>
                  <option value="score">Score</option>
                </select>
              </div>

              {/* Sort Direction Dropdown */}
              <select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="desc">
                  {sortBy === 'submission' ? 'Newest First' : 'High to Low'}
                </option>
                <option value="asc">
                  {sortBy === 'submission' ? 'Oldest First' : 'Low to High'}
                </option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setScoringKeyOpen(true)}
                className="gap-2"
              >
                <Info className="h-4 w-4" />
                Scoring Key
              </Button>

              {!scoresReleased && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleReleaseScores}
                  disabled={releasingScores}
                  className="gap-2"
                >
                  {releasingScores ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Releasing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Release Scores
                    </>
                  )}
                </Button>
              )}
              {scoresReleased && (
                <Badge variant="default" className="bg-green-600">
                  Scores Released
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No attempts yet
            </p>
          ) : (
            <div className="space-y-3">
              {sortedAttempts.map((attempt) => (
                <Card key={attempt.id} className="border-border">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {attempt.user?.name || attempt.user?.email || 'Unknown User'}
                          </p>
                          {getStatusBadge(attempt.status)}
                          {getProctoringBadge(attempt.proctoringScore)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
                          {attempt.gradeEarned !== null && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Score:</span>
                              <span>{(() => {
                                const breakdown = calculateScoreBreakdown(attempt)
                                return `${breakdown.earnedPoints.toFixed(1)} / ${breakdown.gradedTotalPoints.toFixed(1)} pts`
                              })()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            {getGradingStatusBadge(calculateGradingStatus(attempt).status)}
                          </div>
                          {attempt.submittedAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {new Date(attempt.submittedAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          <div className={`flex items-center gap-1 ${(() => {
                            // Calculate actual tab switch count from proctoring events
                            const tabSwitchEvents = attempt.proctorEvents?.filter(
                              e => e.kind === 'TAB_SWITCH' || e.kind === 'BLUR' || e.kind === 'VISIBILITY_HIDDEN'
                            ) || []
                            return tabSwitchEvents.length > 0
                          })() ? 'text-orange-600' : 'text-muted-foreground'}`}>
                            {(() => {
                              // Calculate actual tab switch count from proctoring events
                              const tabSwitchEvents = attempt.proctorEvents?.filter(
                                e => e.kind === 'TAB_SWITCH' || e.kind === 'BLUR' || e.kind === 'VISIBILITY_HIDDEN'
                              ) || []
                              return tabSwitchEvents.length > 0
                            })() && <AlertTriangle className="h-3 w-3" />}
                            <span>
                              {(() => {
                                // Calculate actual tab switch count from proctoring events
                                const tabSwitchEvents = attempt.proctorEvents?.filter(
                                  e => e.kind === 'TAB_SWITCH' || e.kind === 'BLUR' || e.kind === 'VISIBILITY_HIDDEN'
                                ) || []
                                const count = tabSwitchEvents.length
                                return `${count} tab switch${count !== 1 ? 'es' : ''}`
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(attempt)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={(open) => {
        setDetailDialogOpen(open)
        if (!open) {
          // Clear AI suggestions when dialog closes
          setAiSuggestions({})
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attempt Details</DialogTitle>
            <DialogDescription>
              {selectedAttempt?.user?.name || selectedAttempt?.user?.email || 'Unknown User'}
              {selectedAttempt?.club && ` - ${selectedAttempt.club.name}`}
            </DialogDescription>
          </DialogHeader>

          {selectedAttempt && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedAttempt.status)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Grading Status</p>
                  <div className="mt-1">{getGradingStatusBadge(calculateGradingStatus(selectedAttempt).status)}</div>
                </div>
                {selectedAttempt.gradeEarned !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Score</p>
                    <p className="text-lg font-semibold">
                      {(() => {
                        const breakdown = calculateScoreBreakdown(selectedAttempt)
                        return `${breakdown.earnedPoints.toFixed(1)} / ${breakdown.gradedTotalPoints.toFixed(1)} pts`
                      })()}
                    </p>
                    {(() => {
                      const breakdown = calculateScoreBreakdown(selectedAttempt)
                      return breakdown.gradedTotalPoints < breakdown.overallTotalPoints && (
                        <p className="text-xs text-muted-foreground mt-1">
                          (of {breakdown.overallTotalPoints.toFixed(1)} total)
                        </p>
                      )
                    })()}
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Time Taken</p>
                  <p className="text-lg font-semibold">
                    {calculateTimeTaken(selectedAttempt.startedAt, selectedAttempt.submittedAt)}
                  </p>
                </div>
                {selectedAttempt.proctoringScore !== null && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Proctoring</p>
                    <div className="mt-1">{getProctoringBadge(selectedAttempt.proctoringScore)}</div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Tab Switches</p>
                  <p className={`text-lg font-semibold ${(() => {
                    // Calculate actual tab switch count from proctoring events
                    const tabSwitchEvents = selectedAttempt.proctorEvents?.filter(
                      e => e.kind === 'TAB_SWITCH' || e.kind === 'BLUR' || e.kind === 'VISIBILITY_HIDDEN'
                    ) || []
                    return tabSwitchEvents.length > 0
                  })() ? 'text-orange-600' : ''}`}>
                    {(() => {
                      // Calculate actual tab switch count from proctoring events
                      const tabSwitchEvents = selectedAttempt.proctorEvents?.filter(
                        e => e.kind === 'TAB_SWITCH' || e.kind === 'BLUR' || e.kind === 'VISIBILITY_HIDDEN'
                      ) || []
                      return tabSwitchEvents.length
                    })()}
                  </p>
                </div>
                {selectedAttempt.timeOffPageSeconds > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Time Off Page</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {Math.floor(selectedAttempt.timeOffPageSeconds / 60)}m {selectedAttempt.timeOffPageSeconds % 60}s
                    </p>
                  </div>
                )}
                {selectedAttempt.submittedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Submitted</p>
                    <p className="text-sm">{new Date(selectedAttempt.submittedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Proctor Events / Tab-Out Details */}
              {selectedAttempt.proctorEvents && selectedAttempt.proctorEvents.length > 0 && (
                <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      Proctoring Events ({selectedAttempt.proctorEvents.length})
                    </CardTitle>
                    <CardDescription>
                      Detailed timeline of all proctoring events (tab switches, fullscreen exits, devtools, paste/copy, etc.)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAttempt.proctorEvents.map((event, idx) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 p-2 rounded bg-card border border-orange-200 dark:border-orange-800"
                        >
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-xs font-semibold text-orange-700 dark:text-orange-300">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {event.kind === 'TAB_SWITCH' ? 'Tab Switch' :
                                 event.kind === 'VISIBILITY_HIDDEN' ? 'Visibility Hidden' :
                                 event.kind === 'EXIT_FULLSCREEN' ? 'Exit Fullscreen' :
                                 event.kind === 'DEVTOOLS_OPEN' ? 'DevTools Open' :
                                 event.kind === 'CONTEXTMENU' ? 'Context Menu' :
                                 event.kind === 'NETWORK_OFFLINE' ? 'Network Offline' :
                                 event.kind === 'PASTE' ? 'Paste' :
                                 event.kind === 'COPY' ? 'Copy' :
                                 event.kind.replace(/_/g, ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.ts).toLocaleTimeString()}
                              </span>
                              {event.kind === 'TAB_SWITCH' && event.meta && typeof event.meta === 'object' && 'timeOffSeconds' in event.meta && (
                                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                  {typeof event.meta.timeOffSeconds === 'number' && event.meta.timeOffSeconds > 0
                                    ? `Off site: ${Math.floor(event.meta.timeOffSeconds / 60)}m ${event.meta.timeOffSeconds % 60}s`
                                    : 'Off site: <1s'}
                                </span>
                              )}
                            </div>
                            {event.meta && Object.keys(event.meta).length > 0 && (
                              <div className="mt-1">
                                {(() => {
                                  const meta = event.meta as any
                                  
                                  // Format based on event type
                                  if (event.kind === 'PASTE' || event.kind === 'COPY') {
                                    if (meta.dataLength !== undefined) {
                                      return (
                                        <p className="text-xs text-muted-foreground">
                                          Data length: {meta.dataLength} {meta.dataLength === 1 ? 'character' : 'characters'}
                                        </p>
                                      )
                                    }
                                  }
                                  
                                  // Don't show meta for TAB_SWITCH (already shown above) or events with only timestamp/leftAt
                                  if (event.kind === 'TAB_SWITCH') {
                                    return null
                                  }
                                  
                                  // For VISIBILITY_HIDDEN and BLUR, don't show anything if only leftAt/timestamp
                                  if (event.kind === 'VISIBILITY_HIDDEN' || event.kind === 'BLUR') {
                                    const keys = Object.keys(meta)
                                    if (keys.length <= 2 && (keys.includes('timestamp') || keys.includes('leftAt'))) {
                                      return null
                                    }
                                  }
                                  
                                  // For EXIT_FULLSCREEN, don't show if only timestamp
                                  if (event.kind === 'EXIT_FULLSCREEN' && Object.keys(meta).length === 1 && 'timestamp' in meta) {
                                    return null
                                  }
                                  
                                  // Show formatted info for other events
                                  const displayParts: string[] = []
                                  if (meta.dataLength !== undefined) {
                                    displayParts.push(`${meta.dataLength} ${meta.dataLength === 1 ? 'character' : 'characters'}`)
                                  }
                                  if (meta.timeOffSeconds !== undefined) {
                                    const minutes = Math.floor(meta.timeOffSeconds / 60)
                                    const seconds = meta.timeOffSeconds % 60
                                    displayParts.push(`Off site: ${minutes}m ${seconds}s`)
                                  }
                                  
                                  if (displayParts.length > 0) {
                                    return (
                                      <p className="text-xs text-muted-foreground">
                                        {displayParts.join(', ')}
                                      </p>
                                    )
                                  }
                                  
                                  return null
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Answers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-lg">Responses</h3>
                  <div className="flex items-center gap-2">
                    {selectedAttempt.answers.some(a => a.question.type === 'SHORT_TEXT' || a.question.type === 'LONG_TEXT') && (
                      <Button 
                        onClick={() => handleRequestAiGrading('all')} 
                        disabled={requestingAiGrading !== null}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        {requestingAiGrading === 'all' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {requestingAiGrading === 'all' ? 'Generating...' : 'AI Grade All'}
                      </Button>
                    )}
                    <Button 
                      onClick={handleSaveGrades} 
                      disabled={saving}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Grades'}
                    </Button>
                  </div>
                </div>
                {selectedAttempt.answers && selectedAttempt.answers.length > 0 ? (
                  selectedAttempt.answers.map((answer, index) => (
                    <Card key={answer.id} className="border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <CardTitle className="text-base">
                              Question {index + 1}
                            </CardTitle>
                            <div className="text-sm text-muted-foreground mt-1">
                              {(() => {
                                // Parse prompt to hide FRQ_PARTS section in header
                                const promptMd = answer.question.promptMd || ''
                                const frqPartsMatch = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)
                                let mainContent = frqPartsMatch ? promptMd.substring(0, frqPartsMatch.index).trim() : promptMd
                                
                                // Check if this is a fill-in-the-blank question
                                const hasBlanks = /\[blank\d*\]/.test(mainContent)
                                
                                // Split context and prompt if separated by ---
                                const parts = mainContent.split('---').map((p: string) => p.trim()).filter((p: string) => p)
                                const contextSection = parts.length > 1 ? parts[0] : ''
                                const promptSection = parts.length > 1 ? parts[1] : mainContent
                                
                                return (
                                  <div className="space-y-2">
                                    {contextSection && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Context/Stimulus</p>
                                        <QuestionPrompt promptMd={contextSection} />
                                      </div>
                                    )}
                                    {promptSection && (
                                      <div>
                                        {contextSection && <p className="text-xs text-muted-foreground mb-1 mt-2">Question</p>}
                                        {hasBlanks ? (() => {
                                          // Parse fill-in-the-blank question to show inline blanks
                                          const imageRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g
                                          const tableRegex = /(\|.+\|[\r\n]+\|[-:\s|]+\|[\r\n]+(?:\|.+\|(?:\r?\n(?!\r?\n))?)+)/g
                                          
                                          // Remove images and tables from text for blank processing
                                          let textOnly = promptSection.replace(imageRegex, '').replace(tableRegex, '')
                                          
                                          // Split on blank markers
                                          const normalizedText = textOnly.replace(/\[blank\d*\]/g, '[BLANK_MARKER]')
                                          const textSegments: string[] = normalizedText.split('[BLANK_MARKER]')
                                          
                                          return (
                                            <div className="space-y-2">
                                              <div className="text-base leading-relaxed">
                                                {textSegments.map((segment, index) => (
                                                  <span key={index} className="inline">
                                                    {segment && (
                                                      <span className="whitespace-pre-wrap">{segment}</span>
                                                    )}
                                                    {index < textSegments.length - 1 && (
                                                      <Input
                                                        type="text"
                                                        value=""
                                                        disabled
                                                        className="inline-block w-auto min-w-[150px] max-w-[300px] mx-2 align-middle"
                                                      />
                                                    )}
                                                  </span>
                                                ))}
                                              </div>
                                              {/* Render images and tables if they exist */}
                                              {(() => {
                                                const imageMatches: string[] = []
                                                let match
                                                while ((match = imageRegex.exec(promptSection)) !== null) {
                                                  imageMatches.push(match[0])
                                                }
                                                const tableMatches: string[] = []
                                                while ((match = tableRegex.exec(promptSection)) !== null) {
                                                  tableMatches.push(match[0])
                                                }
                                                
                                                if (imageMatches.length > 0 || tableMatches.length > 0) {
                                                  return (
                                                    <div className="space-y-2">
                                                      {imageMatches.map((img, idx) => (
                                                        <div key={`img-${idx}`} className="my-3 rounded-md border border-input overflow-hidden bg-muted/30">
                                                          <img
                                                            src={img.match(/\(([^)]+)\)/)?.[1] || ''}
                                                            alt={img.match(/\[([^\]]*)\]/)?.[1] || 'Image'}
                                                            className="max-w-full max-h-96 object-contain block mx-auto"
                                                          />
                                                        </div>
                                                      ))}
                                                      {tableMatches.map((table, idx) => (
                                                        <div key={`table-${idx}`} className="my-3 rounded-md border border-input overflow-hidden bg-muted/30 p-3">
                                                          <QuestionPrompt promptMd={table} />
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )
                                                }
                                                return null
                                              })()}
                                            </div>
                                          )
                                        })() : (
                                          <QuestionPrompt promptMd={promptSection} />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                            {answer.question.type.startsWith('MCQ') && answer.question.options && (
                              <div className="mt-3">
                                {answer.question.type === 'MCQ_SINGLE' ? (
                                  <RadioGroup 
                                    value={answer.question.options.find((opt: any) => opt.isCorrect)?.id || ""} 
                                    disabled 
                                    className="space-y-2"
                                  >
                                    {answer.question.options.map((option) => (
                                      <div
                                        key={option.id}
                                        className={`flex items-center gap-2 p-3 rounded border ${
                                          option.isCorrect
                                            ? 'border-green-300'
                                            : 'border-border'
                                        }`}
                                      >
                                        <RadioGroupItem value={option.id} id={`preview-${option.id}`} disabled />
                                        <Label htmlFor={`preview-${option.id}`} className="font-normal flex-1 cursor-default">
                                          {option.label}
                                        </Label>
                                        {option.isCorrect && (
                                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                        )}
                                      </div>
                                    ))}
                                  </RadioGroup>
                                ) : (
                                  <div className="space-y-2">
                                    {answer.question.options.map((option) => (
                                      <div
                                        key={option.id}
                                        className={`flex items-center gap-2 p-3 rounded border ${
                                          option.isCorrect
                                            ? 'border-green-300'
                                            : 'border-border'
                                        }`}
                                      >
                                        <Checkbox id={`preview-${option.id}`} checked={option.isCorrect} disabled />
                                        <Label htmlFor={`preview-${option.id}`} className="font-normal flex-1 cursor-default">
                                          {option.label}
                                        </Label>
                                        {option.isCorrect && (
                                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {answer.question.type.replace('MCQ_', '').replace('_', ' ')}
                            </Badge>
                            {answer.gradedAt !== null && answer.pointsAwarded !== null && (
                              <Badge variant={answer.pointsAwarded > 0 ? 'default' : 'destructive'}>
                                {answer.pointsAwarded} / {answer.question.points} pts
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Student's Answer */}
                        {answer.question.type.startsWith('MCQ') && answer.question.options && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                              Student&apos;s Answer
                            </p>
                            {(!answer.selectedOptionIds || answer.selectedOptionIds.length === 0) ? (
                              <div className="whitespace-pre-wrap p-3 bg-muted/30 rounded border">
                                <span className="text-muted-foreground italic">No answer provided</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {answer.question.options
                                  .filter((option) => answer.selectedOptionIds?.includes(option.id))
                                  .map((option) => {
                                    const isSelected = answer.selectedOptionIds?.includes(option.id) || false
                                    const isCorrect = option.isCorrect
                                    return (
                                      <div
                                        key={option.id}
                                        className={`flex items-center gap-2 p-2 rounded border ${
                                          isSelected
                                            ? isCorrect
                                              ? 'border-green-500 bg-green-50 dark:bg-green-950'
                                              : 'border-red-500 bg-red-50 dark:bg-red-950'
                                            : 'border-border'
                                        }`}
                                      >
                                        {isSelected && isCorrect && <CheckCircle className="h-4 w-4 text-green-600" />}
                                        {isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-600" />}
                                        <span className="flex-1">{option.label}</span>
                                      </div>
                                    )
                                  })}
                              </div>
                            )}
                          </div>
                        )}

                        {answer.question.type === 'NUMERIC' && answer.numericAnswer !== null && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                              Student&apos;s Answer
                            </p>
                            <p className="font-mono">{answer.numericAnswer}</p>
                          </div>
                        )}

                        {/* Grading Interface - Available for all question types */}
                        <div className="space-y-4">
                            {/* Student's Answer - Only for FRQ questions */}
                            {(answer.question.type === 'SHORT_TEXT' || answer.question.type === 'LONG_TEXT') && (
                              <>
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Student&apos;s Answer
                                  </p>
                                  </div>
                                  {(() => {
                                    // Check if this is a multipart FRQ
                                    const promptMd = answer.question.promptMd || ''
                                    const frqPartsMatch = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)
                                    
                                    if (frqPartsMatch && answer.answerText) {
                                      // Parse FRQ parts
                                      const partsText = frqPartsMatch[1]
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
                                        // Parse answer text (stored as "part1 | part2 | part3")
                                        const partAnswers = answer.answerText.split(' | ')
                                        const currentPartPoints = gradeEdits[answer.id]?.partPoints || []
                                        
                                        return (
                                          <div className="space-y-5">
                                            {frqParts.map((part, partIdx) => {
                                              const partPoints = currentPartPoints[partIdx] ?? null
                                              const displayValue = partPoints === null || partPoints === undefined ? '' : partPoints
                                              
                                              // Check for part-level AI suggestion
                                              const suggestion = aiSuggestions[answer.id]
                                              let partSuggestion = null
                                              
                                              if (suggestion) {
                                                // Check partSuggestions array first
                                                if (suggestion.partSuggestions && Array.isArray(suggestion.partSuggestions)) {
                                                  partSuggestion = suggestion.partSuggestions.find((p: any) => p.partIndex === partIdx && p.summary)
                                                }
                                                // Fall back to rawResponse
                                                if (!partSuggestion && suggestion.rawResponse?.isMultipart && suggestion.rawResponse?.partSuggestions) {
                                                  const rawParts = suggestion.rawResponse.partSuggestions
                                                  if (Array.isArray(rawParts)) {
                                                    partSuggestion = rawParts.find((p: any) => p.partIndex === partIdx && p.summary)
                                                  }
                                                }
                                              }
                                              
                                              return (
                                                <div key={partIdx} className="relative">
                                                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/60 rounded-full" />
                                                  <div className="pl-6 space-y-3">
                                                    <div className="flex items-start justify-between gap-4">
                                                      <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-2.5">
                                                          <p className="text-base font-semibold text-foreground">
                                                            Part {part.label})
                                                          </p>
                                                          <Badge variant="outline" className="text-xs font-medium px-2 py-0.5">
                                                            {part.points} {part.points === 1 ? 'point' : 'points'}
                                                          </Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{part.prompt}</p>
                                                      </div>
                                                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                        <div className="flex items-center gap-2">
                                                          {!partSuggestion && (
                                                            <Button
                                                              size="sm"
                                                              variant="ghost"
                                                              onClick={() => handleRequestAiGrading('single', answer.id, partIdx)}
                                                              disabled={requestingAiGrading !== null}
                                                              className="h-6 px-2 gap-1 text-xs"
                                                              title="AI Grade this part"
                                                            >
                                                              {requestingAiGrading === `${answer.id}-${partIdx}` ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                              ) : (
                                                                <Sparkles className="h-3 w-3" />
                                                              )}
                                                            </Button>
                                                          )}
                                                          <Label htmlFor={`part-points-${answer.id}-${partIdx}`} className="text-xs font-medium text-muted-foreground">
                                                            Points
                                                          </Label>
                                                        </div>
                                                        <Input
                                                          id={`part-points-${answer.id}-${partIdx}`}
                                                          type="text"
                                                          inputMode="decimal"
                                                          value={(() => {
                                                            // Check if this answer has been edited
                                                            const hasEdit = answer.id in gradeEdits
                                                            const partPoints = hasEdit ? gradeEdits[answer.id]?.partPoints : undefined
                                                            const partValue = partPoints && partPoints[partIdx] !== undefined ? partPoints[partIdx] : null
                                                            if (partValue === null || partValue === undefined) return ''
                                                            return partValue.toString()
                                                          })()}
                                                          onChange={(e) => {
                                                            const inputValue = e.target.value
                                                            // Allow empty string - immediately set to null
                                                            if (inputValue === '' || inputValue === '-') {
                                                              handlePartGradeEdit(answer.id, partIdx, '', part.points)
                                                              return
                                                            }
                                                            
                                                            // Allow typing decimals and numbers
                                                            if (/^-?\d*\.?\d*$/.test(inputValue)) {
                                                              const numValue = parseFloat(inputValue)
                                                              if (!isNaN(numValue) && isFinite(numValue)) {
                                                                // Clamp to max points while typing
                                                                const clampedValue = Math.min(Math.max(0, numValue), part.points)
                                                                handlePartGradeEdit(answer.id, partIdx, clampedValue, part.points)
                                                              } else if (inputValue === '.' || inputValue === '-') {
                                                                // Allow typing decimal point or minus, don't update yet
                                                                // Don't update state for partial input
                                                                return
                                                              } else {
                                                                // Invalid, clear it
                                                                handlePartGradeEdit(answer.id, partIdx, '', part.points)
                                                              }
                                                            }
                                                          }}
                                                          onBlur={(e) => {
                                                            const inputValue = e.target.value.trim()
                                                            // If empty on blur, keep as null (not graded)
                                                            if (inputValue === '' || inputValue === '-' || inputValue === '.') {
                                                              handlePartGradeEdit(answer.id, partIdx, '', part.points)
                                                            } else {
                                                              // Validate and clamp on blur
                                                              const numValue = parseFloat(inputValue)
                                                              if (!isNaN(numValue) && isFinite(numValue)) {
                                                                const clampedValue = Math.min(Math.max(0, numValue), part.points)
                                                                handlePartGradeEdit(answer.id, partIdx, clampedValue, part.points)
                                                              } else {
                                                                // Invalid input, clear it
                                                                handlePartGradeEdit(answer.id, partIdx, '', part.points)
                                                              }
                                                            }
                                                          }}
                                                          className="w-28 h-10 text-sm font-semibold text-center"
                                                        />
                                                        <p className="text-[10px] text-muted-foreground">max: {part.points}</p>
                                                        {partSuggestion && (
                                                          <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                              // Apply part suggestion
                                                              handlePartGradeEdit(answer.id, partIdx, partSuggestion.suggestedScore, part.points)
                                                            }}
                                                            className="h-6 px-2 gap-1 text-xs text-xs border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                                          >
                                                            Apply AI: {partSuggestion.suggestedScore}/{part.points}
                                                          </Button>
                                                        )}
                                                      </div>
                                                    </div>
                                                    {partSuggestion && (
                                                      <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                          <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                                          <span className="text-xs font-semibold text-purple-900 dark:text-purple-100">
                                                            AI Suggestion for Part {part.label}: {partSuggestion.suggestedScore}/{part.points} pts
                                                          </span>
                                                        </div>
                                                        {partSuggestion.summary && (
                                                          <p className="text-xs text-purple-800 dark:text-purple-200">
                                                            {partSuggestion.summary}
                                                          </p>
                                                        )}
                                                      </div>
                                                    )}
                                                    <div className="whitespace-pre-wrap p-4 bg-muted/40 dark:bg-muted/20 rounded-lg border border-border min-h-[100px] shadow-sm">
                                                      {partAnswers[partIdx] && partAnswers[partIdx].trim() ? (
                                                        <p className="text-sm leading-relaxed">{partAnswers[partIdx]}</p>
                                                      ) : (
                                                        <span className="text-muted-foreground italic">No answer provided</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )
                                      }
                                    }
                                    
                                    // Fallback to single answer display
                                    return (
                                      <div className="whitespace-pre-wrap p-4 bg-muted/40 dark:bg-muted/20 rounded-lg border border-border min-h-[100px] shadow-sm">
                                    {answer.answerText && answer.answerText.trim() ? (
                                          <p className="text-sm leading-relaxed">{answer.answerText}</p>
                                    ) : (
                                      <span className="text-muted-foreground italic">No answer provided</span>
                                    )}
                                  </div>
                                    )
                                  })()}
                                </div>

                                {/* Example Solution */}
                                {answer.question.explanation && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase text-green-600 dark:text-green-400 mb-2">
                                      Example Solution / Grading Guide
                                    </p>
                                    <div className="whitespace-pre-wrap p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                                      {answer.question.explanation}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}

                            {/* AI Suggestion */}
                            {aiSuggestions[answer.id] && (
                              <div className="p-5 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-purple-200 dark:border-purple-700">
                                  <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/50">
                                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                                      AI Suggestion
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApplyAiSuggestion(answer.id)}
                                    className="gap-2 border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                                  >
                                    Apply
                                  </Button>
                                </div>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Suggested Score:</span>
                                    <Badge variant="default" className="bg-purple-600 text-white font-semibold">
                                      {aiSuggestions[answer.id].suggestedPoints} / {aiSuggestions[answer.id].maxPoints} pts
                                    </Badge>
                                  </div>
                                  {aiSuggestions[answer.id].explanation && (
                                    <div className="p-3 bg-white/50 dark:bg-purple-950/30 rounded-md border border-purple-100 dark:border-purple-800/50">
                                      <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-1.5 uppercase tracking-wide">
                                        Rationale
                                      </p>
                                      <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                                        {aiSuggestions[answer.id].explanation}
                                      </p>
                                    </div>
                                  )}
                                  {aiSuggestions[answer.id].strengths && (
                                    <div className="p-3 bg-green-50/50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800/50">
                                      <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1.5 uppercase tracking-wide">
                                        Strengths
                                      </p>
                                      <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">
                                        {aiSuggestions[answer.id].strengths}
                                      </p>
                                    </div>
                                  )}
                                  {aiSuggestions[answer.id].gaps && (
                                    <div className="p-3 bg-orange-50/50 dark:bg-orange-950/20 rounded-md border border-orange-200 dark:border-orange-800/50">
                                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1.5 uppercase tracking-wide">
                                        Gaps
                                      </p>
                                      <p className="text-sm text-orange-800 dark:text-orange-200 leading-relaxed">
                                        {aiSuggestions[answer.id].gaps}
                                      </p>
                                    </div>
                                  )}
                                  {aiSuggestions[answer.id].rubricAlignment && (
                                    <div className="p-3 bg-white/50 dark:bg-purple-950/30 rounded-md border border-purple-100 dark:border-purple-800/50">
                                      <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-1.5 uppercase tracking-wide">
                                        Rubric Alignment
                                      </p>
                                      <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                                        {aiSuggestions[answer.id].rubricAlignment}
                                      </p>
                                    </div>
                                  )}
                                  <div className="pt-2 border-t border-purple-200 dark:border-purple-700">
                                    <p className="text-xs text-muted-foreground">
                                      <Clock className="h-3 w-3 inline mr-1" />
                                    Generated: {new Date(aiSuggestions[answer.id].createdAt).toLocaleString()}
                                  </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Grading Interface */}
                            {(() => {
                              // Check if this is a multipart FRQ
                              const promptMd = answer.question.promptMd || ''
                              const frqPartsMatch = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)
                              let frqParts: Array<{ label: string; points: number; prompt: string }> = []
                              
                              if (frqPartsMatch) {
                                const partsText = frqPartsMatch[1]
                                const partRegex = /\[PART:([a-z]):(\d+(?:\.\d+)?)\]\n([\s\S]*?)(?=\n\n\[PART:|$)/g
                                let match
                                
                                while ((match = partRegex.exec(partsText)) !== null) {
                                  frqParts.push({
                                    label: match[1],
                                    points: parseFloat(match[2]),
                                    prompt: match[3].trim(),
                                  })
                                }
                              }
                              
                              const isMultipart = frqParts.length > 0
                              
                              // Check if this answer has been edited in gradeEdits
                              const hasEdit = answer.id in gradeEdits
                              
                              // If edited, use the edited value (even if null - meaning cleared/ungraded)
                              // Otherwise, only use answer.pointsAwarded if it was actually graded (gradedAt is not null)
                              const currentTotal = hasEdit 
                                ? gradeEdits[answer.id]?.pointsAwarded 
                                : (answer.gradedAt !== null ? (answer.pointsAwarded ?? null) : null)
                              
                              // Get partPoints from edits or from saved answer
                              let currentPartPoints: (number | null)[] = []
                              const editPartPoints = hasEdit ? gradeEdits[answer.id]?.partPoints : undefined
                              if (editPartPoints && Array.isArray(editPartPoints)) {
                                currentPartPoints = editPartPoints
                              } else if (answer.graderNote && isMultipart) {
                                // Load from saved graderNote if not in edits
                                try {
                                  const parsed = JSON.parse(answer.graderNote)
                                  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.partPoints)) {
                                    currentPartPoints = parsed.partPoints
                                  }
                                } catch {
                                  // If parsing fails, treat as plain text
                                }
                              }
                              
                              const hasAnyGradedPart = isMultipart && currentPartPoints.some((pts: number | null) => pts !== null && pts !== undefined)
                              // For multipart, check if all parts are graded
                              const allPartsGraded = isMultipart && frqParts.length > 0 && currentPartPoints.length === frqParts.length && 
                                currentPartPoints.every((pts: number | null) => pts !== null && pts !== undefined)
                              const isGraded = isMultipart ? hasAnyGradedPart : (currentTotal !== null && currentTotal !== undefined)
                              const isFullyGraded = isMultipart ? allPartsGraded : (currentTotal !== null && currentTotal !== undefined)
                              
                              return (
                                <div className="space-y-4 p-5 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                                  {isMultipart ? (
                                    <>
                                      {/* Multipart - Show total (no overall AI Grade button, grade by part instead) */}
                                      <div className="flex items-center justify-between pb-3 border-b border-blue-200 dark:border-blue-700">
                                        <div className="flex items-baseline gap-3">
                              <div>
                                            <Label className="text-sm font-semibold text-foreground">
                                              Total Points
                                  </Label>
                                            <div className="flex items-baseline gap-2 mt-1">
                                              {!isGraded ? (
                                                <span className="text-lg text-muted-foreground italic">Ungraded</span>
                                              ) : !isFullyGraded ? (
                                                <span className="text-lg text-orange-600 dark:text-orange-400 italic font-semibold">Partially graded</span>
                                              ) : (
                                                <>
                                                  <span className="text-2xl font-bold">{currentTotal ?? 0}</span>
                                                  <span className="text-sm text-muted-foreground">/ {answer.question.points}</span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      {/* Single Part Grading */}
                                      <div className="flex items-center justify-between pb-3 border-b border-blue-200 dark:border-blue-700">
                                        <div className="flex items-baseline gap-3 flex-1">
                                          <div>
                                            <Label className="text-sm font-semibold text-foreground">
                                              Total Points
                                            </Label>
                                            <div className="flex items-baseline gap-2 mt-1">
                                              {!isGraded ? (
                                                <span className="text-lg text-muted-foreground italic">Ungraded</span>
                                              ) : (
                                                <>
                                                  <span className="text-2xl font-bold">{currentTotal ?? 0}</span>
                                                  <span className="text-sm text-muted-foreground">/ {answer.question.points}</span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                  {!aiSuggestions[answer.id] && (answer.question.type === 'SHORT_TEXT' || answer.question.type === 'LONG_TEXT') && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRequestAiGrading('single', answer.id)}
                                            disabled={requestingAiGrading !== null}
                                      className="h-6 px-2 gap-1 text-xs"
                                    >
                                            {requestingAiGrading === answer.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-3 w-3" />
                                      )}
                                      AI Grade
                                    </Button>
                                  )}
                                </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <Label htmlFor={`points-${answer.id}`} className="text-sm font-semibold">
                                            Points Awarded (max: {answer.question.points})
                                          </Label>
                                <Input
                                  id={`points-${answer.id}`}
                                  type="text"
                                  inputMode="decimal"
                                            value={(() => {
                                              // Check if this answer has been edited
                                              const hasEdit = answer.id in gradeEdits
                                              // If edited, use the edited value (even if null - meaning cleared)
                                              // Otherwise, only use original if it was actually graded
                                              const editValue = hasEdit 
                                                ? gradeEdits[answer.id]?.pointsAwarded
                                                : (answer.gradedAt !== null ? (answer.pointsAwarded ?? null) : null)
                                              
                                              if (editValue === null || editValue === undefined) return ''
                                              return editValue.toString()
                                            })()}
                                            onChange={(e) => {
                                              const inputValue = e.target.value
                                              // Allow empty string - immediately set to null
                                              if (inputValue === '' || inputValue === '-') {
                                                handleGradeEdit(answer.id, 'pointsAwarded', '')
                                                return
                                              }
                                              
                                              // Allow typing decimals and numbers
                                              if (/^-?\d*\.?\d*$/.test(inputValue)) {
                                                const numValue = parseFloat(inputValue)
                                                if (!isNaN(numValue) && isFinite(numValue)) {
                                                  // Clamp to max while typing
                                                  const clampedValue = Math.min(Math.max(0, numValue), answer.question.points)
                                                  handleGradeEdit(answer.id, 'pointsAwarded', clampedValue)
                                                } else if (inputValue === '.' || inputValue === '-') {
                                                  // Allow typing decimal point or minus, don't update yet
                                                  // Don't update state for partial input
                                                  return
                                                } else {
                                                  // Invalid, clear it
                                                  handleGradeEdit(answer.id, 'pointsAwarded', '')
                                                }
                                              }
                                            }}
                                            onBlur={(e) => {
                                              const inputValue = e.target.value.trim()
                                              // If empty on blur, keep as null (not graded)
                                              if (inputValue === '' || inputValue === '-' || inputValue === '.') {
                                                handleGradeEdit(answer.id, 'pointsAwarded', '')
                                              } else {
                                                // Validate and clamp on blur
                                                const numValue = parseFloat(inputValue)
                                                if (!isNaN(numValue) && isFinite(numValue)) {
                                                  const clampedValue = Math.min(Math.max(0, numValue), answer.question.points)
                                                  handleGradeEdit(answer.id, 'pointsAwarded', clampedValue)
                                                } else {
                                                  // Invalid input, clear it
                                                  handleGradeEdit(answer.id, 'pointsAwarded', '')
                                                }
                                              }
                                            }}
                                  className="mt-1"
                                />
                              </div>
                                      </div>
                                    </>
                                  )}
                                  
                                  {/* Feedback Section (common for both) */}
                                  <div className="pt-2">
                                    <Label htmlFor={`feedback-${answer.id}`} className="text-sm font-semibold mb-2 block">
                                  Feedback (optional)
                                </Label>
                                <Textarea
                                  id={`feedback-${answer.id}`}
                                      placeholder="Provide feedback to the student..."
                                  value={gradeEdits[answer.id]?.graderNote ?? ''}
                                  onChange={(e) => handleGradeEdit(answer.id, 'graderNote', e.target.value)}
                                      className="min-h-[100px] resize-y"
                                />
                              </div>
                                  
                              {answer.gradedAt && (
                                    <div className="text-xs text-muted-foreground pt-2 border-t border-blue-200 dark:border-blue-700">
                                      <Clock className="h-3 w-3 inline mr-1" />
                                  Last graded: {new Date(answer.gradedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                              )
                            })()}
                          </div>

                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No answers recorded
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Proctoring Scoring Key Dialog */}
      <Dialog open={scoringKeyOpen} onOpenChange={setScoringKeyOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Proctoring Risk Score Guide
            </DialogTitle>
            <DialogDescription>
              Understanding how suspicious activity is measured
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Score Ranges */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Risk Levels</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Low Risk</span>
                  </div>
                  <span className="text-sm text-muted-foreground">0-39 points</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="font-medium">Medium Risk</span>
                  </div>
                  <span className="text-sm text-muted-foreground">40-74 points</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium">High Risk</span>
                  </div>
                  <span className="text-sm text-muted-foreground">75-100 points</span>
                </div>
              </div>
            </div>

            {/* Event Weights */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Event Weights</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Each event type contributes points to the risk score. Repeated events have diminishing returns.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">DevTools Open</span>
                  <Badge variant="destructive">20</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Exit Fullscreen</span>
                  <Badge variant="destructive">15</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Multi-Monitor Hint</span>
                  <Badge variant="destructive">12</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Tab Switch</span>
                  <Badge variant="default">10</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Copy</span>
                  <Badge variant="default">10</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Visibility Hidden</span>
                  <Badge variant="default">8</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Paste</span>
                  <Badge variant="default">8</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Blur</span>
                  <Badge variant="secondary">5</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Network Offline</span>
                  <Badge variant="secondary">5</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Context Menu</span>
                  <Badge variant="secondary">3</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded border bg-muted/20">
                  <span className="text-sm">Resize</span>
                  <Badge variant="secondary">2</Badge>
                </div>
              </div>
            </div>

            {/* Formula Explanation */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                How It&apos;s Calculated
              </h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Each event adds its weighted points to the total score</li>
                <li>• Repeated events use diminishing returns: <code className="bg-muted px-1 py-0.5 rounded">weight × log(count + 1)</code></li>
                <li>• This prevents excessive penalties for minor repeated actions</li>
                <li>• Total score is capped at 100</li>
                <li>• Example: 1st tab switch ≈ 7-10 pts, 2nd ≈ +5-7 pts, 3rd ≈ +3-5 pts</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

