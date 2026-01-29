'use client'

import { useState, useEffect, useCallback } from 'react'
import type { JSX } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  MapPin,
  Mail,
  Phone,
  User,
  Link as LinkIcon,
  FileText,
} from 'lucide-react'
import { format } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDivision } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// Helper function to highlight search terms in text
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

interface TournamentRequest {
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewNotes: string | null
  createdAt: string
}

export function TournamentRequests() {
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  
  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [requestToDelete, setRequestToDelete] = useState<TournamentRequest | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [requestToReview, setRequestToReview] = useState<TournamentRequest | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | 'PENDING'>('APPROVED')
  const [reviewNotes, setReviewNotes] = useState('')

  const [allRequests, setAllRequests] = useState<TournamentRequest[]>([])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      // Don't send search to server - we'll filter client-side

      const response = await fetch(`/api/tournament-requests?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAllRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Client-side filtering
  const requests = allRequests.filter(req => {
    if (!search) return true
    const query = search.toLowerCase()
    return (
      req.tournamentName.toLowerCase().includes(query) ||
      req.directorName.toLowerCase().includes(query) ||
      req.directorEmail.toLowerCase().includes(query) ||
      (req.directorPhone && req.directorPhone.toLowerCase().includes(query)) ||
      (req.location && req.location.toLowerCase().includes(query)) ||
      (req.preferredSlug && req.preferredSlug.toLowerCase().includes(query))
    )
  })

  const handleUpdateStatus = async () => {
    if (!requestToReview) return

    setActionLoading(requestToReview.id)
    try {
      const response = await fetch(`/api/tournament-requests/${requestToReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewAction,
          reviewNotes: reviewNotes.trim() || null,
        }),
      })

      if (response.ok) {
        await fetchRequests()
        setReviewDialogOpen(false)
        setRequestToReview(null)
        setReviewNotes('')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to update request')
      }
    } catch (error) {
      console.error('Error updating request:', error)
      alert('Error updating request')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!requestToDelete) return

    setActionLoading(requestToDelete.id)
    try {
      const response = await fetch(`/api/tournament-requests/${requestToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchRequests()
        setDeleteDialogOpen(false)
        setRequestToDelete(null)
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to delete request')
      }
    } catch (error) {
      console.error('Error deleting request:', error)
      alert('Error deleting request')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">Approved</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">Rejected</Badge>
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">Pending</Badge>
    }
  }

  const getLevelLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1)
  }

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'in-person':
        return 'In-Person'
      case 'satellite':
        return 'Satellite'
      case 'mini-so':
        return 'Mini SO'
      default:
        return format
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tournament Hosting Requests</CardTitle>
              <CardDescription>
                Review tournament hosting requests submitted through the public form
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search 
                className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" 
                style={{ top: '50%', transform: 'translateY(-50%)' }} 
              />
              <Input
                placeholder="Search by tournament name, director..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="all">All Requests</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Requests List */}
          <ScrollArea className="h-[600px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search 
                  ? 'No requests found' 
                  : statusFilter === 'PENDING'
                    ? 'No pending requests'
                    : statusFilter === 'APPROVED'
                      ? 'No approved requests'
                      : statusFilter === 'REJECTED'
                        ? 'No rejected requests'
                        : 'No requests'}
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 border rounded-xl hover:bg-muted/50 transition-all duration-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {getStatusBadge(req.status)}
                          <Badge variant="outline">Division {formatDivision(req.division)}</Badge>
                          <Badge variant="outline">{getLevelLabel(req.tournamentLevel)}</Badge>
                          <Badge variant="outline">{getFormatLabel(req.tournamentFormat)}</Badge>
                        </div>
                        
                        {/* Tournament Name */}
                        <h3 className="font-semibold text-lg mb-2">{highlightText(req.tournamentName, search)}</h3>
                        
                        {/* Director Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{highlightText(req.directorName, search)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <a href={`mailto:${req.directorEmail}`} className="hover:underline">
                              {highlightText(req.directorEmail, search)}
                            </a>
                          </div>
                          {req.directorPhone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              <span>{highlightText(req.directorPhone, search)}</span>
                            </div>
                          )}
                          {req.location && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>{highlightText(req.location, search)}</span>
                            </div>
                          )}
                          {req.preferredSlug && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <LinkIcon className="h-4 w-4" />
                              <span>teamy.site/tournaments/{highlightText(req.preferredSlug, search)}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Other Notes */}
                        {req.otherNotes && (
                          <div className="mb-3">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                              <FileText className="h-3 w-3" />
                              <span>Notes:</span>
                            </div>
                            <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                              {req.otherNotes}
                            </p>
                          </div>
                        )}
                        
                        {/* Review Notes */}
                        {req.reviewNotes && (
                          <div className="p-2 mt-2 border border-blue-500/50 bg-blue-500/10 rounded text-xs">
                            <span className="font-semibold">Review notes: </span>
                            {req.reviewNotes}
                          </div>
                        )}
                        
                        {/* Timestamp */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Clock className="h-3 w-3" />
                          Submitted {format(new Date(req.createdAt), 'MMM d, yyyy \'at\' h:mm a')}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {req.status === 'PENDING' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setRequestToReview(req)
                                setReviewAction('APPROVED')
                                setReviewNotes('')
                                setReviewDialogOpen(true)
                              }}
                              disabled={actionLoading === req.id}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setRequestToReview(req)
                                setReviewAction('REJECTED')
                                setReviewNotes('')
                                setReviewDialogOpen(true)
                              }}
                              disabled={actionLoading === req.id}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRequestToReview(req)
                              setReviewAction('PENDING')
                              setReviewNotes(req.reviewNotes || '')
                              setReviewDialogOpen(true)
                            }}
                            disabled={actionLoading === req.id}
                          >
                            Reset to Pending
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRequestToDelete(req)
                            setDeleteDialogOpen(true)
                          }}
                          disabled={actionLoading === req.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={(open) => {
        setReviewDialogOpen(open)
        if (!open) {
          setRequestToReview(null)
          setReviewNotes('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'APPROVED' 
                ? 'Approve Request' 
                : reviewAction === 'REJECTED'
                  ? 'Reject Request'
                  : 'Reset Request'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'APPROVED' 
                ? `Are you sure you want to approve "${requestToReview?.tournamentName}"?`
                : reviewAction === 'REJECTED'
                  ? `Are you sure you want to reject "${requestToReview?.tournamentName}"?`
                  : `Reset "${requestToReview?.tournamentName}" to pending status?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="review-notes">Review Notes (Optional)</Label>
              <Textarea
                id="review-notes"
                placeholder="Add any notes about this decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'REJECTED' ? 'destructive' : 'default'}
              onClick={handleUpdateStatus}
              disabled={actionLoading === requestToReview?.id}
            >
              {actionLoading === requestToReview?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {reviewAction === 'APPROVED' 
                ? 'Approve' 
                : reviewAction === 'REJECTED'
                  ? 'Reject'
                  : 'Reset to Pending'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the request for &quot;{requestToDelete?.tournamentName}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading === requestToDelete?.id}
            >
              {actionLoading === requestToDelete?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

