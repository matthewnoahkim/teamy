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
import { Users, Eye, AlertTriangle, CheckCircle, XCircle, Clock, Info, Save, Sparkles, Loader2 } from 'lucide-react'
import { QuestionPrompt } from '@/components/tests/question-prompt'

interface TestAttemptsViewProps {
  testId: string
  testName: string
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
  pointsAwarded: number
  graderNote: string
}

interface Section {
  id: string
  title: string | null
}

export function TestAttemptsView({ testId, testName }: TestAttemptsViewProps) {
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
  const [requestingAiGrading, setRequestingAiGrading] = useState(false)

  useEffect(() => {
    fetchAttempts()
  }, [testId])

  const fetchAttempts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tests/${testId}/attempts`)
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
      edits[answer.id] = {
        answerId: answer.id,
        pointsAwarded: answer.pointsAwarded !== null ? answer.pointsAwarded : 0,
        graderNote: answer.graderNote || '',
      }
    })
    setGradeEdits(edits)
    // Fetch AI suggestions for this attempt
    await fetchAiSuggestions(attempt.id)
  }

  const fetchAiSuggestions = async (attemptId: string) => {
    setLoadingAiSuggestions(true)
    try {
      const response = await fetch(`/api/tests/${testId}/attempts/${attemptId}/ai/suggestions`)
      if (response.ok) {
        const data = await response.json()
        // Create a map of answerId -> suggestion
        const suggestionsMap: Record<string, any> = {}
        data.suggestions?.forEach((suggestion: any) => {
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

  const handleRequestAiGrading = async (mode: 'single' | 'all', answerId?: string) => {
    if (!selectedAttempt) return

    setRequestingAiGrading(true)
    try {
      const response = await fetch(`/api/tests/${testId}/attempts/${selectedAttempt.id}/ai/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, answerId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to request AI grading')
      }

      const data = await response.json()
      
      // Update suggestions map with new suggestions
      const updatedSuggestions = { ...aiSuggestions }
      data.suggestions?.forEach((suggestion: any) => {
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
      setRequestingAiGrading(false)
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
    setGradeEdits((prev) => ({
      ...prev,
      [answerId]: {
        ...prev[answerId],
        [field]: value,
      },
    }))
  }

  const handleSaveGrades = async () => {
    if (!selectedAttempt) return

    setSaving(true)
    try {
      // Send all grades that have been edited
      const gradesToSave = Object.values(gradeEdits).filter((grade) => {
        const answer = selectedAttempt.answers.find((a) => a.id === grade.answerId)
        return answer !== undefined
      })

      const response = await fetch(`/api/tests/${testId}/attempts/${selectedAttempt.id}/grade`, {
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

  const calculateGradingStatus = (attempt: Attempt): {
    status: 'UNGRADED' | 'PARTIALLY_GRADED' | 'FULLY_GRADED'
    gradedCount: number
    totalCount: number
  } => {
    const totalCount = attempt.answers.length
    const gradedCount = attempt.answers.filter((a) => a.gradedAt !== null).length

    let status: 'UNGRADED' | 'PARTIALLY_GRADED' | 'FULLY_GRADED'
    if (gradedCount === 0) {
      status = 'UNGRADED'
    } else if (gradedCount === totalCount) {
      status = 'FULLY_GRADED'
    } else {
      status = 'PARTIALLY_GRADED'
    }

    return { status, gradedCount, totalCount }
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
                          <div className={`flex items-center gap-1 ${attempt.tabSwitchCount > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                            {attempt.tabSwitchCount > 0 && <AlertTriangle className="h-3 w-3" />}
                            <span>{attempt.tabSwitchCount} tab switch{attempt.tabSwitchCount !== 1 ? 'es' : ''}</span>
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
                  <p className={`text-lg font-semibold ${selectedAttempt.tabSwitchCount > 0 ? 'text-orange-600' : ''}`}>
                    {selectedAttempt.tabSwitchCount}
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
                      Detailed timeline of tab switches and other suspicious activity
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAttempt.proctorEvents.map((event, idx) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 p-2 rounded bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-800"
                        >
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-xs font-semibold text-orange-700 dark:text-orange-300">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {event.kind.replace(/_/g, ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.ts).toLocaleTimeString()}
                              </span>
                            </div>
                            {event.meta && Object.keys(event.meta).length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {JSON.stringify(event.meta)}
                              </p>
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
                        disabled={requestingAiGrading}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        {requestingAiGrading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {requestingAiGrading ? 'Generating...' : 'AI Grade All'}
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
                              <QuestionPrompt promptMd={answer.question.promptMd} />
                            </div>
                            {answer.question.type.startsWith('MCQ') && answer.question.options && (
                              <div className="mt-3">
                                {answer.question.type === 'MCQ_SINGLE' ? (
                                  <RadioGroup value="" disabled className="space-y-2">
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
                                        <Checkbox id={`preview-${option.id}`} disabled />
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
                            {answer.pointsAwarded !== null && (
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
                                <div>
                                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                                    Student&apos;s Answer
                                  </p>
                                  <div className="whitespace-pre-wrap p-3 bg-muted/30 rounded border">
                                    {answer.answerText && answer.answerText.trim() ? (
                                      answer.answerText
                                    ) : (
                                      <span className="text-muted-foreground italic">No answer provided</span>
                                    )}
                                  </div>
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
                              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded border border-purple-200 dark:border-purple-800 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                                      AI Suggestion
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApplyAiSuggestion(answer.id)}
                                    className="gap-2"
                                  >
                                    Apply
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Suggested Score:</span>
                                    <Badge variant="default" className="bg-purple-600">
                                      {aiSuggestions[answer.id].suggestedPoints} / {aiSuggestions[answer.id].maxPoints} pts
                                    </Badge>
                                  </div>
                                  {aiSuggestions[answer.id].explanation && (
                                    <div>
                                      <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-1">
                                        Rationale:
                                      </p>
                                      <p className="text-sm text-purple-800 dark:text-purple-200">
                                        {aiSuggestions[answer.id].explanation}
                                      </p>
                                    </div>
                                  )}
                                  {aiSuggestions[answer.id].strengths && (
                                    <div>
                                      <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">
                                        Strengths:
                                      </p>
                                      <p className="text-sm text-purple-800 dark:text-purple-200">
                                        {aiSuggestions[answer.id].strengths}
                                      </p>
                                    </div>
                                  )}
                                  {aiSuggestions[answer.id].gaps && (
                                    <div>
                                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1">
                                        Gaps:
                                      </p>
                                      <p className="text-sm text-purple-800 dark:text-purple-200">
                                        {aiSuggestions[answer.id].gaps}
                                      </p>
                                    </div>
                                  )}
                                  {aiSuggestions[answer.id].rubricAlignment && (
                                    <div>
                                      <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-1">
                                        Rubric Alignment:
                                      </p>
                                      <p className="text-sm text-purple-800 dark:text-purple-200">
                                        {aiSuggestions[answer.id].rubricAlignment}
                                      </p>
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Generated: {new Date(aiSuggestions[answer.id].createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Grading Interface */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <Label htmlFor={`points-${answer.id}`} className="text-sm font-semibold">
                                    Points Awarded (max: {answer.question.points})
                                  </Label>
                                  {!aiSuggestions[answer.id] && (answer.question.type === 'SHORT_TEXT' || answer.question.type === 'LONG_TEXT') && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRequestAiGrading('single', answer.id)}
                                      disabled={requestingAiGrading}
                                      className="h-6 px-2 gap-1 text-xs"
                                    >
                                      {requestingAiGrading ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-3 w-3" />
                                      )}
                                      AI Grade
                                    </Button>
                                  )}
                                </div>
                                <Input
                                  id={`points-${answer.id}`}
                                  type="number"
                                  min="0"
                                  max={answer.question.points}
                                  step="0.5"
                                  value={gradeEdits[answer.id]?.pointsAwarded === 0 ? '' : gradeEdits[answer.id]?.pointsAwarded ?? ''}
                                  onChange={(e) => handleGradeEdit(answer.id, 'pointsAwarded', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                  className="mt-1"
                                  placeholder="0"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label htmlFor={`feedback-${answer.id}`} className="text-sm font-semibold">
                                  Feedback (optional)
                                </Label>
                                <Textarea
                                  id={`feedback-${answer.id}`}
                                  value={gradeEdits[answer.id]?.graderNote ?? ''}
                                  onChange={(e) => handleGradeEdit(answer.id, 'graderNote', e.target.value)}
                                  placeholder="Provide feedback to the student..."
                                  className="mt-1 min-h-[80px]"
                                />
                              </div>
                              {answer.gradedAt && (
                                <div className="md:col-span-2 text-xs text-muted-foreground">
                                  Last graded: {new Date(answer.gradedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
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
        <DialogContent className="max-w-2xl">
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

