'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Send } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PublishTestButtonProps {
  testId: string
  clubId: string
  currentStatus: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
  questionCount: number
}

export function PublishTestButton({
  testId,
  clubId: _clubId,
  currentStatus,
  questionCount,
}: PublishTestButtonProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [addToCalendar, setAddToCalendar] = useState(false)
  const [formData, setFormData] = useState({
    startAt: '',
    endAt: '',
    testPassword: '',
    testPasswordConfirm: '',
    releaseScoresAt: '',
    durationMinutes: '60',
    maxAttempts: '',
    scoreReleaseMode: 'FULL_TEST' as 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST',
    requireFullscreen: true,
  })
  const [dateTimeErrors, setDateTimeErrors] = useState<{ startAt?: string; endAt?: string }>({})

  const handlePublish = async () => {
    if (questionCount === 0) {
      toast({
        title: 'Cannot Publish',
        description: 'Test must have at least one question before publishing',
        variant: 'destructive',
      })
      return
    }

    if (!formData.startAt || !formData.endAt) {
      toast({
        title: 'Error',
        description: 'Start and end times are required',
        variant: 'destructive',
      })
      return
    }

    const start = new Date(formData.startAt)
    const end = new Date(formData.endAt)
    if (end <= start) {
      toast({
        title: 'Error',
        description: 'End time must be after start time',
        variant: 'destructive',
      })
      return
    }

    if (formData.testPassword) {
      if (formData.testPassword.length < 6) {
        toast({
          title: 'Error',
          description: 'Test password must be at least 6 characters',
          variant: 'destructive',
        })
        return
      }

      if (!formData.testPasswordConfirm) {
        toast({
          title: 'Error',
          description: 'Please confirm the password',
          variant: 'destructive',
        })
        return
      }

      if (formData.testPassword !== formData.testPasswordConfirm) {
        toast({
          title: 'Error',
          description: 'Passwords do not match',
          variant: 'destructive',
        })
        return
      }
    }

    setPublishing(true)
    try {
      // Convert datetime-local format to ISO string
      const startAtISO = formData.startAt ? new Date(formData.startAt).toISOString() : undefined
      const endAtISO = formData.endAt ? new Date(formData.endAt).toISOString() : undefined
      const releaseScoresAtISO = formData.releaseScoresAt && formData.releaseScoresAt.trim() 
        ? new Date(formData.releaseScoresAt).toISOString() 
        : undefined

      const response = await fetch(`/api/tests/${testId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: startAtISO,
          endAt: endAtISO,
          testPassword: formData.testPassword || undefined,
          releaseScoresAt: releaseScoresAtISO,
          durationMinutes: parseInt(formData.durationMinutes, 10) || 60,
          maxAttempts: formData.maxAttempts ? parseInt(formData.maxAttempts, 10) : null,
          scoreReleaseMode: formData.scoreReleaseMode,
          requireFullscreen: formData.requireFullscreen,
          addToCalendar: addToCalendar,
        }),
      })

      // Try to parse JSON, but handle cases where response is not JSON (e.g., HTML error page)
      let data: { error?: string; message?: string; details?: string } | null = null
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error('Failed to parse response:', parseError)
        throw new Error(`Server error (${response.status}): Unable to parse response. Please check server logs.`)
      }

      if (!response.ok) {
        const errorMsg = data.message 
          ? `${data.error}: ${data.message}` 
          : data.error || data.details || 'Failed to publish test'
        throw new Error(errorMsg)
      }

      toast({
        title: 'Test Published',
        description: addToCalendar 
          ? 'The test is now visible to assigned members and has been added to the calendar'
          : 'The test is now visible to assigned members',
      })

      setOpen(false)
      setAddToCalendar(false)
      router.refresh()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to publish test',
        variant: 'destructive',
      })
    } finally {
      setPublishing(false)
    }
  }

  if (currentStatus === 'PUBLISHED') {
    return null
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={questionCount === 0}>
        <Send className="h-4 w-4 mr-2" />
        Publish Test
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Publish Test</DialogTitle>
            <DialogDescription>
              Configure test schedule, security settings, and password. Students will need the password to take the test.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {questionCount === 0 && (
              <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                This test has no questions. Add at least one question before publishing.
              </div>
            )}

            <div>
              <Label htmlFor="startAt">Start Date/Time *</Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={formData.startAt}
                onChange={(e) => {
                  const newStartAt = e.target.value
                  setFormData((prev) => ({ ...prev, startAt: newStartAt }))
                  // Validate immediately
                  if (newStartAt && formData.endAt) {
                    const start = new Date(newStartAt)
                    const end = new Date(formData.endAt)
                    if (end <= start) {
                      setDateTimeErrors((prev) => ({ ...prev, endAt: 'End date/time must be after start date/time' }))
                    } else {
                      setDateTimeErrors((prev) => ({ ...prev, endAt: undefined }))
                    }
                  } else {
                    setDateTimeErrors((prev) => ({ ...prev, endAt: undefined }))
                  }
                }}
                required
              />
              {dateTimeErrors.startAt && (
                <p className="text-sm text-destructive mt-1">{dateTimeErrors.startAt}</p>
              )}
            </div>

            <div>
              <Label htmlFor="endAt">End Date/Time *</Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={formData.endAt}
                onChange={(e) => {
                  const newEndAt = e.target.value
                  setFormData((prev) => ({ ...prev, endAt: newEndAt }))
                  // Validate immediately
                  if (formData.startAt && newEndAt) {
                    const start = new Date(formData.startAt)
                    const end = new Date(newEndAt)
                    if (end <= start) {
                      setDateTimeErrors((prev) => ({ ...prev, endAt: 'End date/time must be after start date/time' }))
                    } else {
                      setDateTimeErrors((prev) => ({ ...prev, endAt: undefined }))
                    }
                  } else {
                    setDateTimeErrors((prev) => ({ ...prev, endAt: undefined }))
                  }
                }}
                required
                min={formData.startAt || undefined}
              />
              {dateTimeErrors.endAt && (
                <p className="text-sm text-destructive mt-1">{dateTimeErrors.endAt}</p>
              )}
            </div>

            <div>
              <Label htmlFor="testPassword">Test Password (optional)</Label>
              <Input
                id="testPassword"
                type="password"
                value={formData.testPassword}
                onChange={(e) => setFormData((prev) => ({ ...prev, testPassword: e.target.value }))}
                placeholder="Students need this to take the test"
              />
              <p className="text-xs text-muted-foreground mt-1">
                If set, students will need to enter this password to start the test.
              </p>
            </div>

            {formData.testPassword && (
              <div>
                <Label htmlFor="testPasswordConfirm">Confirm Password</Label>
                <Input
                  id="testPasswordConfirm"
                  type="password"
                  value={formData.testPasswordConfirm}
                  onChange={(e) => setFormData((prev) => ({ ...prev, testPasswordConfirm: e.target.value }))}
                  placeholder="Confirm password"
                />
              </div>
            )}

            <div>
              <Label htmlFor="durationMinutes">Allotted time (minutes) *</Label>
              <Input
                id="durationMinutes"
                type="number"
                min="1"
                value={formData.durationMinutes}
                onChange={(e) => setFormData((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label htmlFor="maxAttempts">Max attempts per user (optional)</Label>
              <Input
                id="maxAttempts"
                type="number"
                min="1"
                value={formData.maxAttempts}
                onChange={(e) => setFormData((prev) => ({ ...prev, maxAttempts: e.target.value }))}
                placeholder="Unlimited if not set"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank for unlimited attempts
              </p>
            </div>

            <div>
              <Label htmlFor="scoreReleaseMode">Score release mode</Label>
              <Select
                value={formData.scoreReleaseMode}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, scoreReleaseMode: value as 'NONE' | 'SCORE_ONLY' | 'SCORE_WITH_WRONG' | 'FULL_TEST' }))}
              >
                <SelectTrigger id="scoreReleaseMode">
                  <SelectValue placeholder="Select release mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TEST">Full test (answers, correctness, feedback)</SelectItem>
                  <SelectItem value="SCORE_WITH_WRONG">Score + wrong questions</SelectItem>
                  <SelectItem value="SCORE_ONLY">Score only</SelectItem>
                  <SelectItem value="NONE">No scores released</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Controls what students see after submission
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="publish-require-fullscreen"
                  checked={formData.requireFullscreen}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, requireFullscreen: checked as boolean }))}
                />
                <Label htmlFor="publish-require-fullscreen" className="cursor-pointer text-sm font-medium">
                  Require fullscreen lockdown
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Lockdown is best-effort. Students will be prompted to stay in fullscreen mode.
              </p>
            </div>

            <div>
              <Label htmlFor="releaseScoresAt">Release Scores (optional)</Label>
              <Input
                id="releaseScoresAt"
                type="datetime-local"
                value={formData.releaseScoresAt}
                onChange={(e) => setFormData((prev) => ({ ...prev, releaseScoresAt: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                When to automatically release scores to students. Leave empty for manual release.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={publishing}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Validate before proceeding
                if (formData.startAt && formData.endAt) {
                  const start = new Date(formData.startAt)
                  const end = new Date(formData.endAt)
                  if (end <= start) {
                    toast({
                      title: 'Error',
                      description: 'End date/time must be after start date/time',
                      variant: 'destructive',
                    })
                    setDateTimeErrors({ endAt: 'End date/time must be after start date/time' })
                    return
                  }
                }
                setOpen(false)
                setCalendarModalOpen(true)
              }}
              disabled={publishing || questionCount === 0}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Calendar Modal */}
      <Dialog open={calendarModalOpen} onOpenChange={setCalendarModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Test to Calendar?</DialogTitle>
            <DialogDescription>
              Would you like to add this test to the calendar for the people assigned to it?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              If you choose Yes, a calendar event will be created and shown to:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground mb-4">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>All club members (if assigned to entire club)</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Members of specific teams (if assigned to teams)</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Users assigned to specific events (if assigned to events)</span>
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddToCalendar(false)
              setCalendarModalOpen(false)
              setConfirmOpen(true)
            }} disabled={publishing}>
              No
            </Button>
            <Button
              onClick={() => {
                setAddToCalendar(true)
                setCalendarModalOpen(false)
                setConfirmOpen(true)
              }}
              disabled={publishing}
            >
              Yes, Add to Calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Publication</DialogTitle>
            <DialogDescription>
              Tests cannot be edited after they are published. You will only be able to update the test schedule and password.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to publish this test? Once published:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Questions and answers cannot be modified</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Test settings (duration, attempts, lockdown) cannot be changed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Assignments cannot be modified</span>
              </li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setConfirmOpen(false)
              setAddToCalendar(false)
            }} disabled={publishing}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false)
                handlePublish()
              }}
              disabled={publishing || questionCount === 0}
              className="bg-primary"
            >
              {publishing ? 'Publishing...' : 'Yes, Publish Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
