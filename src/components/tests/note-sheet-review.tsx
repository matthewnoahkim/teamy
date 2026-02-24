'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle, FileText, User, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function NoteSheetText({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{text}</div>
}

interface NoteSheetReviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  testId: string
  testName: string
}

interface NoteSheet {
  id: string
  type: 'CREATED' | 'UPLOADED'
  content?: string | null
  filePath?: string | null
  filename?: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  rejectionReason?: string | null
  reviewedAt?: string | null
  createdAt: string
  membership: {
    user: {
      id: string
      name: string | null
      email: string
    }
    team?: {
      id: string
      name: string
    } | null
    club?: {
      id: string
      name: string
    } | null
  }
  reviewer?: {
    user: {
      id: string
      name: string | null
      email: string
    }
  } | null
}

export function NoteSheetReview({
  open,
  onOpenChange,
  testId,
  testName,
}: NoteSheetReviewProps) {
  const { toast } = useToast()
  const [noteSheets, setNoteSheets] = useState<NoteSheet[]>([])
  const [loading, setLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState<'ACCEPTED' | 'REJECTED' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    if (open) {
      fetchNoteSheets()
    }
  }, [open, testId])

  const fetchNoteSheets = async () => {
    setLoading(true)
    try {
      // Try TD portal endpoint first (for tournament tests), fallback to regular endpoint
      let response = await fetch(`/api/td/tests/${testId}/note-sheets`)
      if (!response.ok) {
        // Fallback to regular endpoint for club tests
        response = await fetch(`/api/tests/${testId}/note-sheets?admin=true`)
        if (!response.ok) {
          throw new Error('Failed to fetch note sheets')
        }
      }
      const data = await response.json()
      setNoteSheets(data.noteSheets || [])
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load note sheets',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (noteSheetId: string) => {
    if (!reviewStatus) return

    setReviewingId(noteSheetId)
    try {
      // Try TD portal endpoint first (for tournament tests), fallback to regular endpoint
      let response = await fetch(
        `/api/td/tests/${testId}/note-sheets/${noteSheetId}/review`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: reviewStatus,
            rejectionReason: reviewStatus === 'REJECTED' ? rejectionReason : undefined,
          }),
        }
      )
      
      // If TD endpoint fails, try regular endpoint
      if (!response.ok) {
        response = await fetch(
          `/api/tests/${testId}/note-sheets/${noteSheetId}/review`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: reviewStatus,
              rejectionReason: reviewStatus === 'REJECTED' ? rejectionReason : undefined,
            }),
          }
        )
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to review note sheet')
      }

      toast({
        title: 'Success',
        description: `Note sheet ${reviewStatus.toLowerCase()}`,
      })

      setReviewStatus(null)
      setRejectionReason('')
      setReviewingId(null)
      await fetchNoteSheets()
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to review note sheet',
        variant: 'destructive',
      })
    } finally {
      setReviewingId(null)
    }
  }

  const getStatusBadge = (status: NoteSheet['status']) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>
      case 'ACCEPTED':
        return (
          <Badge variant="default" className="bg-green-600">
            Accepted
          </Badge>
        )
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Note Sheets - {testName}</DialogTitle>
          <DialogDescription>
            Review and approve or reject submitted note sheets for this test.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : noteSheets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No note sheets submitted yet
            </div>
          ) : (
            <div className="space-y-4">
              {noteSheets.map((noteSheet) => (
                <Card key={noteSheet.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {noteSheet.membership.user.name || noteSheet.membership.user.email}
                        </CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          {noteSheet.membership.team && (
                            <div className="flex items-center gap-1">
                              <span>Team: <strong>{noteSheet.membership.team.name}</strong></span>
                            </div>
                          )}
                          {noteSheet.membership.club && (
                            <div className="flex items-center gap-1">
                              <span>Club: <strong>{noteSheet.membership.club.name}</strong></span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Submitted {new Date(noteSheet.createdAt).toLocaleDateString()}
                          </div>
                          {noteSheet.reviewedAt && (
                            <div className="flex items-center gap-1">
                              Reviewed {new Date(noteSheet.reviewedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(noteSheet.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {noteSheet.type === 'CREATED' ? (
                      <div className="border rounded-lg p-4 bg-muted/50 max-h-96 overflow-auto">
                        <NoteSheetText
                          text={noteSheet.content || ''}
                          className="whitespace-pre-wrap break-words text-sm leading-6"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                        <FileText className="h-5 w-5" />
                        <div className="flex-1">
                          <p className="font-medium">{noteSheet.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {noteSheet.filePath ? (
                              <a
                                href={noteSheet.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-medium"
                              >
                                View PDF in New Tab
                              </a>
                            ) : (
                              'File not available'
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {noteSheet.status === 'REJECTED' && noteSheet.rejectionReason && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm font-medium text-destructive mb-1">
                          Rejection Reason:
                        </p>
                        <p className="text-sm">{noteSheet.rejectionReason}</p>
                      </div>
                    )}

                    {/* Show review buttons for PENDING and auto-approved ACCEPTED statuses */}
                    {/* For manually approved note sheets (reviewedAt is set), don't show buttons */}
                    {(noteSheet.status === 'PENDING' || (noteSheet.status === 'ACCEPTED' && !noteSheet.reviewedAt)) && (
                      <div className="space-y-3 pt-2 border-t">
                        {/* Only show auto-approval message if it was auto-approved (reviewedAt is null) */}
                        {noteSheet.status === 'ACCEPTED' && !noteSheet.reviewedAt && (
                          <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-2">
                            <p className="text-sm text-blue-900 dark:text-blue-100">
                              This note sheet was auto-approved. You can still reject it if needed.
                            </p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (reviewingId === noteSheet.id && reviewStatus === 'ACCEPTED') {
                                // If already selected, submit it
                                handleReview(noteSheet.id)
                              } else {
                                // Otherwise, select it
                                setReviewStatus('ACCEPTED')
                                setReviewingId(noteSheet.id)
                                setRejectionReason('')
                              }
                            }}
                            variant={reviewingId === noteSheet.id && reviewStatus === 'ACCEPTED' ? 'default' : 'outline'}
                            className="flex-1"
                            disabled={noteSheet.status === 'ACCEPTED' && reviewingId !== noteSheet.id}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            {reviewingId === noteSheet.id && reviewStatus === 'ACCEPTED' 
                              ? 'Confirm Acceptance' 
                              : noteSheet.status === 'ACCEPTED'
                              ? 'Already Accepted'
                              : 'Accept'}
                          </Button>
                          {/* Only show reject button for PENDING or auto-approved (reviewedAt is null) */}
                          {(noteSheet.status === 'PENDING' || (noteSheet.status === 'ACCEPTED' && !noteSheet.reviewedAt)) && (
                            <Button
                              size="sm"
                              variant={reviewingId === noteSheet.id && reviewStatus === 'REJECTED' ? 'destructive' : 'outline'}
                              onClick={() => {
                                if (reviewingId === noteSheet.id && reviewStatus === 'REJECTED') {
                                  // If already selected, submit it (rejection reason is optional)
                                  handleReview(noteSheet.id)
                                } else {
                                  // Otherwise, select it
                                  setReviewStatus('REJECTED')
                                  setReviewingId(noteSheet.id)
                                }
                              }}
                              className="flex-1"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {reviewingId === noteSheet.id && reviewStatus === 'REJECTED' ? 'Submit Rejection' : 'Reject'}
                            </Button>
                          )}
                        </div>

                        {reviewingId === noteSheet.id && reviewStatus === 'REJECTED' && (
                          <div className="space-y-2">
                            <Label htmlFor="rejection-reason">Rejection Message (Optional)</Label>
                            <Textarea
                              id="rejection-reason"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Add an optional message explaining why this note sheet is being rejected..."
                              rows={3}
                            />
                            <p className="text-xs text-muted-foreground">
                              This message is optional. If provided, it will be shown to the student.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

