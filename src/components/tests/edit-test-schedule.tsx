'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Edit } from 'lucide-react'

interface EditTestScheduleProps {
  testId: string
  currentStartAt: Date | null
  currentEndAt: Date | null
}

export function EditTestSchedule({
  testId,
  currentStartAt,
  currentEndAt,
}: EditTestScheduleProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [formData, setFormData] = useState({
    startAt: currentStartAt
      ? new Date(currentStartAt).toISOString().slice(0, 16)
      : '',
    endAt: currentEndAt ? new Date(currentEndAt).toISOString().slice(0, 16) : '',
  })
  const [dateTimeErrors, setDateTimeErrors] = useState<{ startAt?: string; endAt?: string }>({})

  const handleUpdate = async () => {
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

    setUpdating(true)
    try {
      const startAtISO = new Date(formData.startAt).toISOString()
      const endAtISO = new Date(formData.endAt).toISOString()

      const response = await fetch(`/api/tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: startAtISO,
          endAt: endAtISO,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update schedule')
      }

      toast({
        title: 'Schedule Updated',
        description: 'Test start and end times have been updated',
      })

      setOpen(false)
      router.refresh()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update schedule',
        variant: 'destructive',
      })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8 gap-1"
      >
        <Edit className="h-3 w-3" />
        Edit Schedule
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Test Schedule</DialogTitle>
            <DialogDescription>
              Update the start and end times for this test. Changes will affect test availability.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="editStartAt">Start Date/Time *</Label>
              <Input
                id="editStartAt"
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
              <Label htmlFor="editEndAt">End Date/Time *</Label>
              <Input
                id="editEndAt"
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setFormData({
                  startAt: currentStartAt
                    ? new Date(currentStartAt).toISOString().slice(0, 16)
                    : '',
                  endAt: currentEndAt
                    ? new Date(currentEndAt).toISOString().slice(0, 16)
                    : '',
                })
              }}
              disabled={updating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={updating || !!dateTimeErrors.startAt || !!dateTimeErrors.endAt}
            >
              {updating ? 'Updating...' : 'Update Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

