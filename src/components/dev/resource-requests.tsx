'use client'

import { useState, useEffect, useCallback } from 'react'
import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  Search,
  RefreshCw,
  Loader2,
  Mail,
  User,
  Building2,
  Tag,
  FolderOpen,
} from 'lucide-react'
import { format } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Predefined resource tags (same as tools-tab.tsx)
const RESOURCE_TAGS = [
  { value: 'wiki', label: 'Wiki' },
  { value: 'textbook', label: 'Textbook' },
  { value: 'video', label: 'Video' },
  { value: 'practice', label: 'Practice' },
  { value: 'misc', label: 'Miscellaneous' },
]

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

interface ResourceRequest {
  id: string
  name: string
  tag: string
  url: string | null
  category: string
  scope: 'CLUB' | 'PUBLIC'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
  createdAt: string
  reviewedAt: string | null
  club: {
    id: string
    name: string
  }
  requestedBy: {
    user: {
      id: string
      name: string | null
      email: string
    }
  }
}

export function ResourceRequests() {
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [selectedRequest, setSelectedRequest] = useState<ResourceRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { toast } = useToast()

  const [allRequests, setAllRequests] = useState<ResourceRequest[]>([])
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [requestToApprove, setRequestToApprove] = useState<ResourceRequest | null>(null)
  const [editedName, setEditedName] = useState('')
  const [editedTag, setEditedTag] = useState('')
  const [editedUrl, setEditedUrl] = useState('')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      // Don't send search to server - we'll filter client-side

      const response = await fetch(`/api/resources/requests?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setAllRequests(data.requests || [])
      } else {
        const errorData = await response.json()
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to fetch resource requests',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch resource requests',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Client-side filtering
  const requests = allRequests.filter(req => {
    if (!search) return true
    const query = search.toLowerCase()
    return (
      req.name.toLowerCase().includes(query) ||
      req.tag.toLowerCase().includes(query) ||
      req.category.toLowerCase().includes(query) ||
      req.club.name.toLowerCase().includes(query) ||
      req.requestedBy.user.email.toLowerCase().includes(query) ||
      (req.requestedBy.user.name && req.requestedBy.user.name.toLowerCase().includes(query)) ||
      (req.url && req.url.toLowerCase().includes(query))
    )
  })

  const openApproveDialog = (request: ResourceRequest) => {
    setRequestToApprove(request)
    setEditedName(request.name)
    setEditedTag(request.tag)
    setEditedUrl(request.url || '')
    setApproveDialogOpen(true)
  }

  const handleApprove = async () => {
    if (!requestToApprove) return

    if (!editedName.trim() || !editedTag.trim()) {
      toast({
        title: 'Error',
        description: 'Name and tag are required',
        variant: 'destructive',
      })
      return
    }

    setActionLoading(requestToApprove.id)
    try {
      const response = await fetch(`/api/resources/requests/${requestToApprove.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'approve',
          editedName: editedName.trim(),
          editedTag: editedTag.trim(),
          editedUrl: editedUrl.trim() || null,
        }),
      })

      if (response.ok) {
        await fetchRequests()
        setApproveDialogOpen(false)
        setRequestToApprove(null)
        toast({
          title: 'Success',
          description: 'Resource request approved and added to public resources',
        })
      } else {
        const errorData = await response.json()
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to approve request',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve request',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a rejection reason',
        variant: 'destructive',
      })
      return
    }

    setActionLoading(selectedRequest.id)
    try {
      const response = await fetch(`/api/resources/requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reject',
          rejectionReason: rejectionReason.trim(),
        }),
      })

      if (response.ok) {
        await fetchRequests()
        setSelectedRequest(null)
        setRejectionReason('')
        toast({
          title: 'Success',
          description: 'Resource request rejected',
        })
      } else {
        const errorData = await response.json()
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to reject request',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject request',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleReset = async (request: ResourceRequest) => {
    setActionLoading(request.id)
    try {
      const response = await fetch(`/api/resources/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })

      if (response.ok) {
        await fetchRequests()
        toast({
          title: 'Success',
          description: 'Resource request reset to pending',
        })
      } else {
        const errorData = await response.json()
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to reset request',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset request',
        variant: 'destructive',
      })
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

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resource Requests</CardTitle>
              <CardDescription>
                Review and approve resource submissions from clubs
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
                placeholder="Search by resource name, tag, category..."
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
                          <Badge variant="outline">
                            <Tag className="h-3 w-3 mr-1" />
                            {highlightText(req.tag, search)}
                          </Badge>
                          <Badge variant="outline">
                            <FolderOpen className="h-3 w-3 mr-1" />
                            {highlightText(req.category, search)}
                          </Badge>
                        </div>
                        
                        {/* Resource Name */}
                        <h3 className="font-semibold text-lg mb-2">{highlightText(req.name, search)}</h3>
                        
                        {/* Resource Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-sm">
                          {req.url && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <ExternalLink className="h-4 w-4" />
                              <a href={req.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                {highlightText(req.url, search)}
                              </a>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            <span>{highlightText(req.club.name, search)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{highlightText(req.requestedBy.user.name || req.requestedBy.user.email, search)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <a href={`mailto:${req.requestedBy.user.email}`} className="hover:underline">
                              {highlightText(req.requestedBy.user.email, search)}
                            </a>
                          </div>
                        </div>
                        
                        {/* Rejection Reason */}
                        {req.rejectionReason && (
                          <div className="p-2 mt-2 border border-red-500/50 bg-red-500/10 rounded text-xs">
                            <span className="font-semibold">Rejection reason: </span>
                            {req.rejectionReason}
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
                              onClick={() => openApproveDialog(req)}
                              disabled={actionLoading === req.id}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedRequest(req)
                                setRejectionReason('')
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
                            onClick={() => handleReset(req)}
                            disabled={actionLoading === req.id}
                          >
                            {actionLoading === req.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-1" />
                            )}
                            Reset to Pending
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => {
        if (!open) {
          setSelectedRequest(null)
          setRejectionReason('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Resource Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject &quot;{selectedRequest?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Add any notes about this decision..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedRequest(null)
              setRejectionReason('')
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading === selectedRequest?.id || !rejectionReason.trim()}
            >
              {actionLoading === selectedRequest?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setApproveDialogOpen(false)
          setRequestToApprove(null)
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve Resource</DialogTitle>
            <DialogDescription>
              Review and edit the resource details before making it public.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Resource name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tag">Type *</Label>
              <Select value={editedTag} onValueChange={setEditedTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TAGS.map((tag) => (
                    <SelectItem key={tag.value} value={tag.value}>
                      {tag.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={editedUrl}
                onChange={(e) => setEditedUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>
            {requestToApprove && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                  <span>Category: {requestToApprove.category}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>From: {requestToApprove.club.name}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setApproveDialogOpen(false)
              setRequestToApprove(null)
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={actionLoading === requestToApprove?.id || !editedName.trim() || !editedTag.trim()}
            >
              {actionLoading === requestToApprove?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve & Make Public
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

