'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { formatDateTime } from '@/lib/utils'
import { Plus, Send, Trash2, ChevronDown, ChevronUp, Edit, MessageCircle, X, Calendar, MapPin, Check, X as XIcon, Paperclip, Mail } from 'lucide-react'
import { AttachmentDisplay } from '@/components/ui/attachment-display'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EmojiPicker } from '@/components/emoji-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { PageLoading } from '@/components/ui/loading-spinner'
import { useBackgroundRefresh } from '@/hooks/use-background-refresh'

interface StreamTabProps {
  clubId: string
  currentMembership: any
  teams: any[]
  isAdmin: boolean
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  initialAnnouncements?: any[]
}

type AnnouncementsResponse = {
  announcements: any[]
}

type ApiErrorResponse = {
  error?: string
  message?: string
}

async function performRequest(url: string, options: RequestInit = {}, fallbackMessage: string) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiErrorResponse
    const detailedMessage = [errorData.error, errorData.message].filter(Boolean).join(': ')
    throw new Error(detailedMessage || fallbackMessage)
  }
  return response
}

export function StreamTab({ clubId, currentMembership, teams, isAdmin, user, initialAnnouncements }: StreamTabProps) {
  const { toast } = useToast()
  const [announcements, setAnnouncements] = useState<any[]>(initialAnnouncements || [])
  const [loading, setLoading] = useState(!initialAnnouncements)
  const [posting, setPosting] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scope, setScope] = useState<'CLUB' | 'TEAM'>('CLUB')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [availableEvents, setAvailableEvents] = useState<any[]>([])
  const [sendEmail, setSendEmail] = useState(false)
  const [important, setImportant] = useState(false)
  const [isPostSectionCollapsed, setIsPostSectionCollapsed] = useState(true)
  const [editingAnnouncement, setEditingAnnouncement] = useState<any | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editImportant, setEditImportant] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState<Record<string, string>>({})
  const [postingReply, setPostingReply] = useState<Record<string, boolean>>({})
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({})
  const [reacting, setReacting] = useState<Record<string, boolean>>({})
  const [deleteReplyDialogOpen, setDeleteReplyDialogOpen] = useState(false)
  const [replyToDelete, setReplyToDelete] = useState<string | null>(null)
  const [deletingReply, setDeletingReply] = useState(false)
  const [rsvping, setRsvping] = useState<Record<string, boolean>>({})
  const [showImportantOnly, setShowImportantOnly] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const memberUserId = currentMembership?.userId as string | undefined
  const announcementMap = useMemo(() => {
    const map = new Map<string, any>()
    announcements.forEach((announcement) => {
      map.set(announcement.id, announcement)
    })
    return map
  }, [announcements])

  const replyMap = useMemo(() => {
    const map = new Map<string, { reply: any; announcementId: string }>()
    announcements.forEach((announcement) => {
      announcement.replies?.forEach((reply: any) => {
        map.set(reply.id, { reply, announcementId: announcement.id })
      })
    })
    return map
  }, [announcements])

  const filteredAnnouncements = useMemo(
    () => (showImportantOnly ? announcements.filter((a) => a.important) : announcements),
    [announcements, showImportantOnly],
  )

  const fetchAnnouncements = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const response = await performRequest(
        `/api/announcements?clubId=${clubId}`,
        {},
        'Failed to fetch announcements',
      )
      const data = (await response.json()) as AnnouncementsResponse
      setAnnouncements(data.announcements)
    } catch (error) {
      console.error('Failed to fetch announcements:', error)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [clubId])

  useEffect(() => {
    // Skip initial fetch if we already have data from server
    if (!initialAnnouncements) {
      fetchAnnouncements()
    }
  }, [fetchAnnouncements, initialAnnouncements])

  useBackgroundRefresh(
    () => fetchAnnouncements({ silent: true }),
    {
      intervalMs: 30_000,
      runOnMount: false,
    },
  )

  // Fetch events for the team's division - defer to not block initial render
  useEffect(() => {
    // Defer this fetch slightly to prioritize announcements
    const timer = setTimeout(() => {
      const fetchEvents = async () => {
        try {
          // Get team's division from first membership
          const teamResponse = await fetch(`/api/clubs/${clubId}`)
          if (teamResponse.ok) {
            const teamData = await teamResponse.json()
            const division = teamData.team?.division
            
            if (division) {
              const eventsResponse = await fetch(`/api/events?division=${division}`)
              if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json()
                setAvailableEvents(eventsData.events || [])
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch events:', error)
        }
      }
      
      fetchEvents()
    }, 200) // Small delay to not block initial render
    
    return () => clearTimeout(timer)
  }, [clubId])

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    setPosting(true)

    // Store form data for optimistic update
    const formDataToPost = {
      title,
      content,
      scope,
      selectedTeams,
      selectedRoles,
      selectedEvents,
      sendEmail,
      important,
      selectedFiles,
    }

    // Create optimistic announcement
    const tempAnnouncement = {
      id: `temp-${Date.now()}`,
      title,
      content,
      important,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: currentMembership.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      },
      replies: [],
      reactions: [],
      attachments: [],
      visibilities: scope === 'TEAM' 
        ? [{ scope: 'TEAM' }]
        : selectedTeams.map((teamId) => ({
            scope: 'TEAM',
            subclubId: teamId,
            team: teams.find((s) => s.id === teamId),
          })),
    }

    // Optimistically add announcement to the top of the list
    setAnnouncements((prev) => [tempAnnouncement, ...prev])

    // Clear form immediately
    setTitle('')
    setContent('')
    setSelectedRoles([])
    setSelectedEvents([])
    setSendEmail(false)
    setImportant(false)
    setSelectedFiles([])
    setIsPostSectionCollapsed(true) // Collapse the form after successful post

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          title: formDataToPost.title,
          content: formDataToPost.content,
          scope: formDataToPost.scope,
          teamIds: formDataToPost.scope === 'TEAM' ? formDataToPost.selectedTeams : undefined,
          targetRoles: formDataToPost.selectedRoles.length > 0 ? formDataToPost.selectedRoles : undefined,
          targetEvents: formDataToPost.selectedEvents.length > 0 ? formDataToPost.selectedEvents : undefined,
          sendEmail: formDataToPost.sendEmail,
          important: formDataToPost.important,
        }),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setAnnouncements((prev) => prev.filter((a) => a.id !== tempAnnouncement.id))
        const errorData = (await response.json().catch(() => ({}))) as ApiErrorResponse
        console.error('Announcement post error:', errorData)
        const errorMsg = errorData.error || 'Failed to post announcement'
        const detailMsg = errorData.message || ''
        throw new Error(detailMsg ? `${errorMsg}: ${detailMsg}` : errorMsg)
      }

      const rawData: unknown = await response.json().catch(() => null)
      let announcementId: string | undefined
      let serverAnnouncement: any = null
      
      if (
        rawData &&
        typeof rawData === 'object' &&
        'announcement' in rawData &&
        rawData.announcement &&
        typeof rawData.announcement === 'object' &&
        'id' in rawData.announcement
      ) {
        serverAnnouncement = rawData.announcement
        announcementId = (rawData.announcement as { id?: string }).id
      }

      // Upload files if any
      if (formDataToPost.selectedFiles.length > 0 && announcementId) {
        setUploadingFiles(true)
        try {
          await Promise.all(
            formDataToPost.selectedFiles.map(async (file) => {
              const formData = new FormData()
              formData.append('file', file)
              formData.append('announcementId', announcementId!)

              const uploadResponse = await fetch('/api/attachments/upload', {
                method: 'POST',
                body: formData,
              })

              if (!uploadResponse.ok) {
                throw new Error(`Failed to upload ${file.name}`)
              }
            })
          )
        } catch (error) {
          console.error('File upload error:', error)
          toast({
            title: 'Warning',
            description: 'Announcement posted but some files failed to upload',
            variant: 'destructive',
          })
        } finally {
          setUploadingFiles(false)
        }
      }

      // Replace temp announcement with server response
      if (serverAnnouncement) {
        setAnnouncements((prev) =>
          prev.map((announcement) =>
            announcement.id === tempAnnouncement.id ? serverAnnouncement : announcement
          )
        )
      } else {
        // If server response doesn't include full announcement, remove temp and refetch
        setAnnouncements((prev) => prev.filter((a) => a.id !== tempAnnouncement.id))
        fetchAnnouncements()
      }

      toast({
        title: 'Announcement posted',
        description: formDataToPost.sendEmail ? 'Emails are being sent.' : undefined,
      })
    } catch (error: any) {
      console.error('Post announcement error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to post announcement',
        variant: 'destructive',
      })
    } finally {
      setPosting(false)
    }
  }

  const handleDeleteClick = (announcementId: string) => {
    setAnnouncementToDelete(announcementId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!announcementToDelete) return

    try {
      const response = await fetch(`/api/announcements/${announcementToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as ApiErrorResponse
        throw new Error(errorData.error || 'Failed to delete announcement')
      }

      toast({
        title: 'Announcement deleted',
        description: 'The announcement has been removed',
      })

      fetchAnnouncements()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete announcement',
        variant: 'destructive',
      })
    } finally {
      setDeleteDialogOpen(false)
      setAnnouncementToDelete(null)
    }
  }

  const canDeleteAnnouncement = (announcement: any) => {
    // Can delete if you're the author or an admin
    return announcement.authorId === currentMembership.id || isAdmin
  }

  const canEditAnnouncement = (announcement: any) => {
    // Cannot edit announcements linked to calendar events (only delete them)
    if (announcement.calendarEvent) {
      return false
    }
    // Can only edit if you're the author (not just any admin)
    return announcement.authorId === currentMembership.id
  }

  const handleEditClick = (announcement: any) => {
    setEditingAnnouncement(announcement)
    setEditTitle(announcement.title)
    setEditContent(announcement.content)
    setEditImportant(announcement.important || false)
    setIsEditDialogOpen(true)
  }

  const handlePostReply = async (announcementId: string) => {
    const content = replyContent[announcementId]?.trim()
    if (!content) return

    setPostingReply((prev) => ({ ...prev, [announcementId]: true }))

    // Optimistically create a temporary reply
    const tempReply = {
      id: `temp-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: currentMembership.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      },
      reactions: [],
    }

    // Optimistically add reply to announcements
    setAnnouncements((prev) =>
      prev.map((announcement) =>
        announcement.id === announcementId
          ? {
              ...announcement,
              replies: [...(announcement.replies || []), tempReply],
            }
          : announcement
      )
    )

    // Clear the input immediately
    setReplyContent((prev) => ({ ...prev, [announcementId]: '' }))

    try {
      const response = await fetch(`/api/announcements/${announcementId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setAnnouncements((prev) =>
          prev.map((announcement) =>
            announcement.id === announcementId
              ? {
                  ...announcement,
                  replies: (announcement.replies || []).filter((r: any) => r.id !== tempReply.id),
                }
              : announcement
          )
        )
        throw new Error('Failed to post reply')
      }

      const data = await response.json()
      
      // Replace temp reply with real one from server
      setAnnouncements((prev) =>
        prev.map((announcement) =>
          announcement.id === announcementId
            ? {
                ...announcement,
                replies: (announcement.replies || []).map((r: any) =>
                  r.id === tempReply.id ? data.reply : r
                ),
              }
            : announcement
        )
      )

      toast({
        title: 'Reply posted',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to post reply',
        variant: 'destructive',
      })
    } finally {
      setPostingReply((prev) => ({ ...prev, [announcementId]: false }))
    }
  }

  const toggleReplies = (announcementId: string) => {
    setShowReplies((prev) => ({
      ...prev,
      [announcementId]: !prev[announcementId],
    }))
  }

  const handleReactionToggle = async (targetType: 'announcement' | 'reply', targetId: string, emoji: string) => {
    const key = `${targetType}-${targetId}-${emoji}`
    setReacting((prev) => ({ ...prev, [key]: true }))

    try {
      // Check if user already reacted with this emoji
      let hasReacted = false
      let currentReactions: any[] = []
      
      if (targetType === 'announcement') {
        const announcement = announcements.find(a => a.id === targetId)
        hasReacted = announcement?.reactions?.some((r: any) => 
          r.emoji === emoji && r.user.id === currentMembership.userId
        )
        currentReactions = announcement?.reactions || []
      } else {
        // For replies, find the reply in any announcement
        for (const announcement of announcements) {
          const reply = announcement.replies?.find((r: any) => r.id === targetId)
          if (reply) {
            hasReacted = reply.reactions?.some((r: any) => 
              r.emoji === emoji && r.user.id === currentMembership.userId
            )
            currentReactions = reply.reactions || []
            break
          }
        }
      }

      // Optimistically update reactions
      const optimisticReactions = hasReacted
        ? currentReactions.filter((r: any) => !(r.emoji === emoji && r.user.id === currentMembership.userId))
        : [
            ...currentReactions,
            {
              id: `temp-${Date.now()}`,
              emoji,
              user: {
                id: currentMembership.userId,
                name: user.name,
                email: user.email,
                image: user.image,
              },
            },
          ]

      // Update state optimistically
      if (targetType === 'announcement') {
        setAnnouncements((prev) =>
          prev.map((announcement) =>
            announcement.id === targetId
              ? { ...announcement, reactions: optimisticReactions }
              : announcement
          )
        )
      } else {
        setAnnouncements((prev) =>
          prev.map((announcement) => ({
            ...announcement,
            replies: (announcement.replies || []).map((reply: any) =>
              reply.id === targetId ? { ...reply, reactions: optimisticReactions } : reply
            ),
          }))
        )
      }

      // Make API call
      if (hasReacted) {
        // Remove reaction
        const response = await fetch(`/api/reactions?targetType=${targetType}&targetId=${targetId}&emoji=${encodeURIComponent(emoji)}`, {
          method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to remove reaction')
      } else {
        // Add reaction
        const response = await fetch('/api/reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emoji,
            targetType,
            targetId,
          }),
        })
        if (!response.ok) throw new Error('Failed to add reaction')
        
        // If response includes reaction data, use it to replace temp reaction
        try {
          const data = await response.json()
          if (data.reaction) {
            if (targetType === 'announcement') {
              setAnnouncements((prev) =>
                prev.map((announcement) =>
                  announcement.id === targetId
                    ? {
                        ...announcement,
                        reactions: (announcement.reactions || []).map((r: any) =>
                          r.id?.startsWith('temp-') && r.emoji === emoji ? data.reaction : r
                        ),
                      }
                    : announcement
                )
              )
            } else {
              setAnnouncements((prev) =>
                prev.map((announcement) => ({
                  ...announcement,
                  replies: (announcement.replies || []).map((reply: any) =>
                    reply.id === targetId
                      ? {
                          ...reply,
                          reactions: (reply.reactions || []).map((r: any) =>
                            r.id?.startsWith('temp-') && r.emoji === emoji ? data.reaction : r
                          ),
                        }
                      : reply
                  ),
                }))
              )
            }
          }
        } catch (e) {
          // If response doesn't include reaction, that's okay - optimistic update is fine
        }
      }
    } catch (error) {
      // Revert optimistic update on error
      fetchAnnouncements()
      toast({
        title: 'Error',
        description: 'Failed to update reaction',
        variant: 'destructive',
      })
    } finally {
      setReacting((prev) => ({ ...prev, [key]: false }))
    }
  }

  const getReactionSummary = (reactions: any[]) => {
    if (!reactions || reactions.length === 0) return []
    
    const summary: Array<{ emoji: string; count: number; hasUserReacted: boolean }> = []
    const grouped = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = { count: 0, hasUserReacted: false }
      }
      acc[reaction.emoji].count++
      // Check if current user has reacted with this emoji
      // Use currentMembership.userId for comparison since that's the actual user ID
      if (reaction.user.id === currentMembership.userId) {
        acc[reaction.emoji].hasUserReacted = true
      }
      return acc
    }, {} as Record<string, { count: number; hasUserReacted: boolean }>)

    Object.keys(grouped).forEach((emoji) => {
      const info = grouped[emoji]
      summary.push({
        emoji,
        count: info.count,
        hasUserReacted: info.hasUserReacted,
      })
    })

    return summary.sort((a, b) => b.count - a.count)
  }

  const handleDeleteReplyClick = (replyId: string) => {
    setReplyToDelete(replyId)
    setDeleteReplyDialogOpen(true)
  }

  const handleDeleteReply = async () => {
    if (!replyToDelete) return

    setDeletingReply(true)

    try {
      // Find the announcement that contains this reply
      const announcement = announcements.find(a => 
        a.replies?.some((r: any) => r.id === replyToDelete)
      )

      if (!announcement) {
        throw new Error('Announcement not found')
      }

      const response = await fetch(`/api/announcements/${announcement.id}/replies/${replyToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as ApiErrorResponse
        throw new Error(errorData.error || 'Failed to delete reply')
      }

      toast({
        title: 'Reply deleted',
        description: 'Your reply has been deleted',
      })

      setDeleteReplyDialogOpen(false)
      setReplyToDelete(null)
      
      // Refresh announcements to get updated data
      fetchAnnouncements()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete reply',
        variant: 'destructive',
      })
    } finally {
      setDeletingReply(false)
    }
  }

  const canDeleteReply = (reply: any) => {
    // Members can delete their own replies
    if (reply.author.user.id === currentMembership.userId) return true
    // Admins can delete any reply
    if (isAdmin) return true
    return false
  }

  const handleRSVP = async (eventId: string, status: 'YES' | 'NO') => {
    setRsvping((prev) => ({ ...prev, [eventId]: true }))

    try {
      const response = await fetch(`/api/calendar/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error('Failed to RSVP')
      }

      toast({
        title: status === 'YES' ? 'RSVP: Going' : 'RSVP: Not Going',
      })

      // Refresh announcements to get updated RSVP data
      await fetchAnnouncements()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update RSVP',
        variant: 'destructive',
      })
    } finally {
      setRsvping((prev) => ({ ...prev, [eventId]: false }))
    }
  }

  const handleRemoveRSVP = async (eventId: string) => {
    setRsvping((prev) => ({ ...prev, [eventId]: true }))

    try {
      const response = await fetch(`/api/calendar/${eventId}/rsvp`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove RSVP')
      }

      toast({
        title: 'RSVP removed',
      })

      // Refresh announcements to get updated RSVP data
      await fetchAnnouncements()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove RSVP',
        variant: 'destructive',
      })
    } finally {
      setRsvping((prev) => ({ ...prev, [eventId]: false }))
    }
  }

  const getUserRSVP = (event: any) => {
    if (!event?.rsvps) return null
    return event.rsvps.find((r: any) => r.userId === currentMembership.userId)
  }

  const getRSVPCounts = (event: any) => {
    if (!event?.rsvps) return { yesCount: 0, noCount: 0 }
    const yesCount = event.rsvps.filter((r: any) => r.status === 'YES').length
    const noCount = event.rsvps.filter((r: any) => r.status === 'NO').length
    return { yesCount, noCount }
  }

  const formatEventTime = (event: any) => {
    const startDate = new Date(event.startUTC)
    const endDate = new Date(event.endUTC)
    
    // Check if it's an all-day event
    const isAllDay = startDate.getHours() === 0 && startDate.getMinutes() === 0 && 
                     endDate.getHours() === 23 && endDate.getMinutes() === 59
    
    if (isAllDay) {
      if (startDate.toDateString() === endDate.toDateString()) {
        return startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      } else {
        const startDay = startDate.getDate()
        const endDay = endDate.getDate()
        const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' })
        const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' })
        const startYear = startDate.getFullYear()
        const endYear = endDate.getFullYear()
        
        if (startMonth === endMonth && startYear === endYear) {
          return `${startMonth} ${startDay}-${endDay}, ${startYear}`
        } else if (startYear === endYear) {
          return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`
        } else {
          return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`
        }
      }
    } else {
      return `${startDate.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })} - ${endDate.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}`
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsEditing(true)

    try {
      const response = await fetch(`/api/announcements/${editingAnnouncement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          important: editImportant,
        }),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as ApiErrorResponse
        throw new Error(errorData.error || 'Failed to update announcement')
      }

      toast({
        title: 'Announcement updated',
        description: 'The announcement has been updated successfully',
      })

      setIsEditDialogOpen(false)
      setEditingAnnouncement(null)
      fetchAnnouncements()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update announcement',
        variant: 'destructive',
      })
    } finally {
      setIsEditing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Only show post announcement section to admins */}
      {isAdmin && (
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => setIsPostSectionCollapsed(!isPostSectionCollapsed)}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="text-base">Post Announcement</span>
            </div>
            {isPostSectionCollapsed ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronUp className="h-5 w-5" />
            )}
          </CardTitle>
        </CardHeader>
        {!isPostSectionCollapsed && (
          <CardContent>
          <form onSubmit={handlePost} className="space-y-6">
            {/* Main Content Section */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's this announcement about?"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="content" className="text-sm font-medium">Message</Label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your message here..."
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mt-1.5"
                  required
                />
              </div>
            </div>

            {/* Audience Section */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h4 className="text-sm font-semibold">Audience</h4>
              <RadioGroup value={scope} onValueChange={(value) => {
                const newScope = value as 'CLUB' | 'TEAM'
                setScope(newScope)
                // Clear selected teams when switching to Entire Club
                if (newScope === 'CLUB') {
                  setSelectedTeams([])
                }
              }} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CLUB" id="scope-club" />
                  <Label htmlFor="scope-club" className="cursor-pointer font-normal text-sm">
                    Entire Club
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="TEAM" id="scope-team" />
                  <Label htmlFor="scope-team" className="cursor-pointer font-normal text-sm">
                    Specific Teams
                  </Label>
                </div>
              </RadioGroup>
              {scope === 'TEAM' && (
                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground mb-2 block">Select Teams</Label>
                  <div className="flex flex-wrap gap-2">
                    {teams.map((team) => (
                      <label key={team.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-background cursor-pointer hover:bg-accent transition-colors">
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={selectedTeams.includes(team.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              // When a team is checked, switch to TEAM scope automatically
                              setScope('TEAM')
                              setSelectedTeams((prev) => [...prev, team.id])
                            } else {
                              setSelectedTeams((prev) => prev.filter((id) => id !== team.id))
                            }
                          }}
                        />
                        <span className="text-sm">{team.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Email Notification Toggle */}
              <div className="pt-3 border-t border-border/50">
                <label className="inline-flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    id="sendEmail"
                    checked={sendEmail}
                    onCheckedChange={(checked) => setSendEmail(checked as boolean)}
                  />
                  <Mail className="h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <span className="text-sm font-medium group-hover:text-primary transition-colors block">Send email notification</span>
                    <span className="text-xs text-muted-foreground">Recipients will be notified via email</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Advanced Targeting Section - Collapsible */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
                <ChevronDown className="h-4 w-4" />
                Advanced Targeting (Optional)
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4 pl-6 border-l-2 border-muted">
                <div>
                  <Label className="text-sm font-medium">Target by Role</Label>
                  <p className="text-xs text-muted-foreground mb-2">Only notify members with these roles</p>
                  <div className="flex flex-wrap gap-2">
                    {['COACH', 'CAPTAIN', 'MEMBER'].map((role) => (
                      <label key={role} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-background cursor-pointer hover:bg-accent transition-colors">
                        <Checkbox
                          id={`role-${role}`}
                          checked={selectedRoles.includes(role)}
                          onCheckedChange={(checked) => {
                            setSelectedRoles((prev) =>
                              checked
                                ? [...prev, role]
                                : prev.filter((r) => r !== role)
                            )
                          }}
                        />
                        <span className="text-sm capitalize">{role.toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Target by Event</Label>
                  <p className="text-xs text-muted-foreground mb-2">Only notify participants of these events</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-md border bg-background/50">
                    {availableEvents.map((event) => (
                      <label key={event.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border bg-background cursor-pointer hover:bg-accent transition-colors text-xs">
                        <Checkbox
                          id={`event-${event.id}`}
                          checked={selectedEvents.includes(event.id)}
                          onCheckedChange={(checked) => {
                            setSelectedEvents((prev) =>
                              checked
                                ? [...prev, event.id]
                                : prev.filter((id) => id !== event.id)
                            )
                          }}
                        />
                        <span>{event.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Options Section */}
            <div className="space-y-3 pt-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <Checkbox
                  id="important"
                  checked={important}
                  onCheckedChange={(checked) => setImportant(checked as boolean)}
                />
                <span className="text-sm font-medium">Mark as important</span>
              </label>

              {/* File Attachments */}
              <div className="space-y-2">
                <Label htmlFor="files" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <Paperclip className="h-4 w-4" />
                  Attach Files
                </Label>
                <Input
                  id="files"
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length > 0) {
                      setSelectedFiles((prev) => [...prev, ...files])
                    }
                  }}
                  className="cursor-pointer"
                />
                {selectedFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5 p-2 rounded-md border bg-muted/30">
                    {selectedFiles.map((file, index) => {
                      const key = file.name ? `${file.name}-${index}` : `file-${index}`
                      return (
                      <div key={key} className="flex items-center gap-2 text-sm bg-background px-2 py-1.5 rounded">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button type="submit" disabled={posting || uploadingFiles} className="w-full sm:w-auto">
                <Send className="mr-2 h-4 w-4" />
                {uploadingFiles ? 'Uploading Files...' : posting ? 'Posting...' : 'Post Announcement'}
              </Button>
            </div>
          </form>
        </CardContent>
        )}
      </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-3xl font-bold">Recent Announcements</h3>
          <Button
            variant={showImportantOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowImportantOnly(!showImportantOnly)}
          >
            Important Only
          </Button>
        </div>
        {loading ? (
          <PageLoading
            title="Loading announcements"
            description="Fetching the latest updates from your team..."
            variant="orbit"
          />
        ) : (() => {
          const filteredAnnouncements = showImportantOnly 
            ? announcements.filter(a => a.important)
            : announcements
          
          return filteredAnnouncements.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                {showImportantOnly ? 'No important announcements' : 'No announcements yet'}
              </CardContent>
            </Card>
          ) : (
            filteredAnnouncements.map((announcement) => (
            <Card key={announcement.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={announcement.author.user.image || ''} />
                      <AvatarFallback>
                        {announcement.author.user.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{announcement.title}</p>
                        {announcement.important && (
                          <Badge variant="destructive" className="text-xs">IMPORTANT</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        by {announcement.author.user.name || announcement.author.user.email} •{' '}
                        {formatDateTime(announcement.createdAt)}
                        {announcement.updatedAt && new Date(announcement.updatedAt).getTime() !== new Date(announcement.createdAt).getTime() && (
                          <span className="ml-1 text-muted-foreground italic">(edited)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {announcement.visibilities.map((v: any) => (
                        <Badge key={v.id} variant="secondary" className="text-xs">
                          {v.scope === 'CLUB' ? 'CLUB' : v.team?.name || 'TEAM'}
                        </Badge>
                      ))}
                    </div>
                    {canEditAnnouncement(announcement) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(announcement)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteAnnouncement(announcement) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(announcement.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* For event announcements, show subtitle format */}
                {announcement.calendarEvent ? (
                  <div className="space-y-4">
                    {/* Subtitle: Time, Date, Location */}
                    <div className="space-y-1 pb-3 border-b">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <p className="text-sm font-medium">{formatEventTime(announcement.calendarEvent)}</p>
                      </div>
                      {announcement.calendarEvent.location && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <p className="text-sm">{announcement.calendarEvent.location}</p>
                        </div>
                      )}
                    </div>

                    {/* Event Details/Description */}
                    {announcement.calendarEvent.description && (
                      <p className="whitespace-pre-wrap text-sm">{announcement.calendarEvent.description}</p>
                    )}
                    
                    {/* RSVP Section - Only show if RSVP is enabled */}
                    {announcement.calendarEvent.rsvpEnabled && (
                    <div className="pt-3 border-t">
                          <p className="text-sm font-medium mb-2">Your RSVP</p>
                          <div className="flex gap-2 mb-3">
                            {(() => {
                              const userRsvp = getUserRSVP(announcement.calendarEvent)
                              return (
                                <>
                                  <Button
                                    size="sm"
                                    variant={userRsvp?.status === 'YES' ? 'default' : 'outline'}
                                    onClick={() => handleRSVP(announcement.calendarEvent.id, 'YES')}
                                    disabled={rsvping[announcement.calendarEvent.id]}
                                  >
                                    <Check className="mr-2 h-4 w-4" />
                                    Going
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={userRsvp?.status === 'NO' ? 'default' : 'outline'}
                                    onClick={() => handleRSVP(announcement.calendarEvent.id, 'NO')}
                                    disabled={rsvping[announcement.calendarEvent.id]}
                                  >
                                    <XIcon className="mr-2 h-4 w-4" />
                                    Not Going
                                  </Button>
                                  {userRsvp && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRemoveRSVP(announcement.calendarEvent.id)}
                                      disabled={rsvping[announcement.calendarEvent.id]}
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </>
                              )
                            })()}
                          </div>

                          {/* RSVP Counts and Lists */}
                          {(() => {
                            const { yesCount, noCount } = getRSVPCounts(announcement.calendarEvent)
                            const yesRsvps = announcement.calendarEvent.rsvps?.filter((r: any) => r.status === 'YES') || []
                            const noRsvps = announcement.calendarEvent.rsvps?.filter((r: any) => r.status === 'NO') || []
                            
                            return (
                              <div className="space-y-3 text-sm">
                                {yesCount > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Check className="h-4 w-4 text-green-600" />
                                      <p className="font-medium">Going ({yesCount})</p>
                                    </div>
                                    <div className="space-y-1 pl-6">
                                      {yesRsvps.map((rsvp: any) => (
                                        <div key={rsvp.id} className="flex items-center gap-2">
                                          <Avatar className="h-6 w-6">
                                            <AvatarImage src={rsvp.user.image || ''} />
                                            <AvatarFallback className="text-xs">
                                              {rsvp.user.name?.charAt(0) || rsvp.user.email.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-sm">{rsvp.user.name || rsvp.user.email}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {noCount > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <XIcon className="h-4 w-4 text-red-600" />
                                      <p className="font-medium">Not Going ({noCount})</p>
                                    </div>
                                    <div className="space-y-1 pl-6">
                                      {noRsvps.map((rsvp: any) => (
                                        <div key={rsvp.id} className="flex items-center gap-2">
                                          <Avatar className="h-6 w-6">
                                            <AvatarImage src={rsvp.user.image || ''} />
                                            <AvatarFallback className="text-xs">
                                              {rsvp.user.name?.charAt(0) || rsvp.user.email.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <span className="text-sm">{rsvp.user.name || rsvp.user.email}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {yesCount === 0 && noCount === 0 && (
                                  <p className="text-muted-foreground">No RSVPs yet</p>
                                )}
                              </div>
                            )
                          })()}
                    </div>
                    )}
                  </div>
                ) : (
                  /* Regular announcement without calendar event */
                  <p className="whitespace-pre-wrap text-sm">{announcement.content}</p>
                )}
                
                {/* Attachments Section */}
                {announcement.attachments && announcement.attachments.length > 0 && (
                  <div className="mt-4">
                    <AttachmentDisplay
                      attachments={announcement.attachments}
                      canDelete={canEditAnnouncement(announcement)}
                      onDelete={async (attachmentId) => {
                        try {
                          const response = await fetch(`/api/attachments/upload?id=${attachmentId}`, {
                            method: 'DELETE',
                          })
                          if (response.ok) {
                            fetchAnnouncements()
                          }
                        } catch (error) {
                          console.error('Failed to delete attachment:', error)
                        }
                      }}
                    />
                  </div>
                )}
                
                {/* Reactions Section */}
                <div className="mt-4">
                  <EmojiPicker
                    onEmojiSelect={(emoji) => handleReactionToggle('announcement', announcement.id, emoji)}
                    onReactionToggle={(emoji) => handleReactionToggle('announcement', announcement.id, emoji)}
                    currentReactions={getReactionSummary(announcement.reactions || [])}
                  />
                </div>
                
                {/* Reply Section */}
                <div className="mt-4 border-t pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleReplies(announcement.id)}
                    className="mb-2"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {announcement.replies?.length || 0} {announcement.replies?.length === 1 ? 'Reply' : 'Replies'}
                    {showReplies[announcement.id] ? (
                      <ChevronUp className="ml-2 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-2 h-4 w-4" />
                    )}
                  </Button>

                  {showReplies[announcement.id] && (
                    <div className="space-y-3">
                      {/* Existing Replies */}
                      {announcement.replies && announcement.replies.length > 0 && (
                        <div className="space-y-3">
                          {announcement.replies.map((reply: any) => (
                            <div key={reply.id} className="flex gap-3 pl-4 border-l-2 border-muted">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarImage src={reply.author.user.image || ''} />
                                <AvatarFallback>
                                  {reply.author.user.name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">
                                      {reply.author.user.name || reply.author.user.email}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDateTime(reply.createdAt)}
                                    </p>
                                  </div>
                                  {canDeleteReply(reply) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteReplyClick(reply.id)}
                                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {reply.content}
                                </p>
                                {/* Reply Reactions */}
                                <div className="mt-2">
                                  <EmojiPicker
                                    onEmojiSelect={(emoji) => handleReactionToggle('reply', reply.id, emoji)}
                                    onReactionToggle={(emoji) => handleReactionToggle('reply', reply.id, emoji)}
                                    currentReactions={getReactionSummary(reply.reactions || [])}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Input */}
                      <div className="flex gap-2 mt-3 items-center">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={user.image || ''} />
                          <AvatarFallback>
                            {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex gap-2 items-center">
                          <Input
                            placeholder="Write a reply..."
                            value={replyContent[announcement.id] || ''}
                            onChange={(e) =>
                              setReplyContent((prev) => ({
                                ...prev,
                                [announcement.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handlePostReply(announcement.id)
                              }
                            }}
                            disabled={postingReply[announcement.id]}
                          />
                          <Button
                            size="sm"
                            onClick={() => handlePostReply(announcement.id)}
                            disabled={
                              !replyContent[announcement.id]?.trim() ||
                              postingReply[announcement.id]
                            }
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
          )
        })()}
      </div>

      {/* Edit Announcement Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Announcement title"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-content">Message</Label>
              <textarea
                id="edit-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Write your message..."
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-important"
                checked={editImportant}
                onCheckedChange={(checked) => setEditImportant(checked as boolean)}
              />
              <Label htmlFor="edit-important" className="cursor-pointer font-normal">
                Mark as important
              </Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing ? 'Updating...' : 'Update Announcement'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Reply Dialog */}
      <Dialog open={deleteReplyDialogOpen} onOpenChange={setDeleteReplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reply</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this reply? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteReplyDialogOpen(false)}
              disabled={deletingReply}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteReply}
              disabled={deletingReply}
            >
              {deletingReply ? 'Deleting...' : 'Delete Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

