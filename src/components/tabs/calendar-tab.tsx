'use client'

import { useState, useEffect, useCallback } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageLoading, ButtonLoading } from '@/components/ui/loading-spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Trash2, Pencil, Check, X as XIcon, User, Paperclip, X, Calendar, FileText } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { EventAnnouncementModal } from '@/components/event-announcement-modal'
import { AttachmentDisplay } from '@/components/ui/attachment-display'
import { useBackgroundRefresh } from '@/hooks/use-background-refresh'

interface CalendarTabProps {
  clubId: string
  currentMembership: any
  isAdmin: boolean
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  initialEvents?: any[]
}

type ViewMode = 'month' | 'week'

export function CalendarTab({ clubId, currentMembership, isAdmin, user, initialEvents }: CalendarTabProps) {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [events, setEvents] = useState<any[]>(initialEvents || [])
  const [teams, setTeams] = useState<any[]>([])
  const [availableEvents, setAvailableEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(!initialEvents)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<any>(null)
  const [rsvping, setRsvping] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [createdEvent, setCreatedEvent] = useState<any>(null)
  const [showImportantOnly, setShowImportantOnly] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  
  // Helper function to format date for datetime-local input
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }
  
  const getInitialFormData = (prefilledDate?: Date, isAllDay: boolean = false) => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinutes = now.getMinutes()
    
    // Use prefilled date if provided, otherwise use today's date
    const start = prefilledDate ? new Date(prefilledDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Determine suggested hour
    let suggestedHour: number
    if (prefilledDate && prefilledDate.getHours() !== 0) {
      // If a specific time was clicked (with non-zero hour), use that exact time
      suggestedHour = prefilledDate.getHours()
    } else {
      // For "New Event" button or month view day clicks, suggest the next complete hour
      // If it's 7:30, suggest 8:00-9:00
      if (currentMinutes > 0) {
        suggestedHour = currentHour + 1
      } else {
        // If exactly on the hour (7:00), suggest current hour
        suggestedHour = currentHour
      }
      
      // Handle hour overflow: if it's 11 PM (23), suggest 12 AM (0) next day
      if (suggestedHour >= 24) {
        suggestedHour = 0
        // Move to next day for start time
        start.setDate(start.getDate() + 1)
      }
    }
    
    start.setHours(suggestedHour, 0, 0, 0)
    const end = new Date(start)
    
    // Handle hour overflow (23:00 -> 00:00 next day)
    const endHour = suggestedHour + 1
    if (endHour >= 24) {
      end.setDate(end.getDate() + 1)
      end.setHours(endHour - 24, 0, 0, 0)
    } else {
      end.setHours(endHour, 0, 0, 0)
    }
    
    // Helper function to format date as YYYY-MM-DD in local timezone
    const formatDateLocal = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    return {
      title: '',
      description: '',
      date: formatDateLocal(start), // YYYY-MM-DD format in local timezone
      startTime: `${String(suggestedHour).padStart(2, '0')}:00`,
      endTime: `${String(endHour >= 24 ? endHour - 24 : endHour).padStart(2, '0')}:00`,
      isAllDay: isAllDay,
      startDate: formatDateLocal(start),
      endDate: formatDateLocal(end),
      location: '',
      color: '#3b82f6', // Default blue
      scope: 'PERSONAL' as 'PERSONAL' | 'TEAM' | 'CLUB',
      teamId: '',
      attendeeId: currentMembership.id,
      rsvpEnabled: true, // Default to enabled
      important: false,
      targetRoles: [] as string[],
      targetEvents: [] as string[],
      isRecurring: false,
      recurrenceRule: 'WEEKLY' as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
      recurrenceInterval: 1,
      recurrenceDaysOfWeek: [] as number[],
      recurrenceEndType: 'date' as 'date' | 'count',
      recurrenceEndDate: formatDateLocal(new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)), // 30 days from now
      recurrenceCount: 10,
    }
  }
  
  const [formData, setFormData] = useState(getInitialFormData())

  const fetchEvents = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const response = await fetch(`/api/calendar?clubId=${clubId}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events)
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [clubId])

  const fetchTeams = useCallback(async () => {
    try {
      const response = await fetch(`/api/clubs/${clubId}/teams`)
      if (response.ok) {
        const data = await response.json()
        setTeams(data.teams)
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    }
  }, [clubId])

  const fetchAvailableEvents = useCallback(async () => {
    try {
      // Get team info to determine division
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
      console.error('Failed to fetch Science Olympiad events:', error)
    }
  }, [clubId])

  useEffect(() => {
    // Skip initial fetch if we already have data from server
    if (!initialEvents) {
      fetchEvents()
    }
    fetchTeams()
    fetchAvailableEvents()
  }, [fetchEvents, fetchTeams, fetchAvailableEvents, initialEvents])

  useBackgroundRefresh(
    () => fetchEvents({ silent: true }),
    {
      intervalMs: 35_000,
      runOnMount: false,
    },
  )

  // Handle opening event from URL parameter
  useEffect(() => {
    const eventId = searchParams.get('eventId')
    if (eventId && events.length > 0 && !loading) {
      const event = events.find(e => e.id === eventId)
      if (event && !eventDetailsOpen) {
        setSelectedEvent(event)
        setEventDetailsOpen(true)
        // Clean up URL parameter after opening
        const newSearchParams = new URLSearchParams(searchParams.toString())
        newSearchParams.delete('eventId')
        const newUrl = `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
        router.replace(newUrl)
      }
    }
  }, [searchParams, events, eventDetailsOpen, router, loading])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let startISO: string
      let endISO: string

      if (formData.isAllDay) {
        // All day event - start at 00:00, end at 23:59
        const startDate = new Date(formData.startDate + 'T00:00:00')
        const endDate = new Date(formData.endDate + 'T23:59:59')
        
        // Validate that end date is not before start date
        if (endDate < startDate) {
          throw new Error('End date cannot be before start date')
        }
        
        startISO = startDate.toISOString()
        endISO = endDate.toISOString()
      } else {
        // Regular event with specific time
        const startDateTime = new Date(formData.date + 'T' + formData.startTime + ':00')
        let endDateTime = new Date(formData.date + 'T' + formData.endTime + ':00')
        
        // If end time is before or equal to start time, it's likely the next day
        // (e.g., 11 PM to 12 AM, or 2 PM to 1 PM)
        if (endDateTime <= startDateTime) {
          // Add one day to the end date
          endDateTime = new Date(endDateTime)
          endDateTime.setDate(endDateTime.getDate() + 1)
        }
        
        startISO = startDateTime.toISOString()
        endISO = endDateTime.toISOString()
      }

      const payload: any = {
        clubId,
        scope: formData.scope,
        title: formData.title,
        startUTC: startISO,
        endUTC: endISO,
        color: formData.color,
        important: formData.important,
      }

      // Only include rsvpEnabled for CLUB and TEAM events
      if (formData.scope === 'CLUB' || formData.scope === 'TEAM') {
        payload.rsvpEnabled = formData.rsvpEnabled
      }

      if (formData.description) {
        payload.description = formData.description
      }
      if (formData.location) {
        payload.location = formData.location
      }

      if (formData.scope === 'TEAM') {
        if (formData.teamId) {
          payload.teamId = formData.teamId
        }
      } else if (formData.scope === 'PERSONAL') {
        payload.attendeeId = formData.attendeeId
      }

      // Add role and event targeting for club/team events
      if (isAdmin && (formData.scope === 'CLUB' || formData.scope === 'TEAM')) {
        if (formData.targetRoles && formData.targetRoles.length > 0) {
          payload.targetRoles = formData.targetRoles
        }
        if (formData.targetEvents && formData.targetEvents.length > 0) {
          payload.targetEvents = formData.targetEvents
        }
      }

      // Add recurrence data if event is recurring
      if (formData.isRecurring) {
        payload.isRecurring = true
        payload.recurrenceRule = formData.recurrenceRule
        payload.recurrenceInterval = formData.recurrenceInterval
        
        if (formData.recurrenceRule === 'WEEKLY' && formData.recurrenceDaysOfWeek.length > 0) {
          payload.recurrenceDaysOfWeek = formData.recurrenceDaysOfWeek
        }
        
        if (formData.recurrenceEndType === 'date') {
          payload.recurrenceEndDate = new Date(formData.recurrenceEndDate + 'T23:59:59').toISOString()
        } else {
          payload.recurrenceCount = formData.recurrenceCount
        }
      }

      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMsg = data.error || 'Failed to create event'
        const detailMsg = data.message || ''
        console.error('Event creation error:', data)
        
        // Show user-friendly error message
        throw new Error(detailMsg ? `${errorMsg}: ${detailMsg}` : errorMsg)
      }

      const data = await response.json()
      const newEvent = data.event

      // Upload files if any
      if (selectedFiles.length > 0 && newEvent.id) {
        setUploadingFiles(true)
        try {
          await Promise.all(
            selectedFiles.map(async (file) => {
              const formData = new FormData()
              formData.append('file', file)
              formData.append('calendarEventId', newEvent.id)

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
            description: 'Event created but some files failed to upload',
            variant: 'destructive',
          })
        } finally {
          setUploadingFiles(false)
        }
      }

      toast({
        title: 'Event created',
        description: formData.title,
      })

      setCreateOpen(false)
      const createdFormData = { ...formData }
      setFormData(getInitialFormData())
      setSelectedFiles([])
      fetchEvents()

      // Show announcement modal for CLUB or TEAM events created by admins
      if (isAdmin && (createdFormData.scope === 'CLUB' || createdFormData.scope === 'TEAM')) {
        setCreatedEvent({ ...newEvent, formData: createdFormData })
        setShowAnnouncementModal(true)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create event',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent) return

    setLoading(true)

    try {
      let startISO: string
      let endISO: string

      if (formData.isAllDay) {
        // All day event - start at 00:00, end at 23:59
        const startDate = new Date(formData.startDate + 'T00:00:00')
        const endDate = new Date(formData.endDate + 'T23:59:59')
        
        // Validate that end date is not before start date
        if (endDate < startDate) {
          throw new Error('End date cannot be before start date')
        }
        
        startISO = startDate.toISOString()
        endISO = endDate.toISOString()
      } else {
        // Regular event with specific time
        const startDateTime = new Date(formData.date + 'T' + formData.startTime + ':00')
        let endDateTime = new Date(formData.date + 'T' + formData.endTime + ':00')
        
        // If end time is before or equal to start time, it's likely the next day
        // (e.g., 11 PM to 12 AM, or 2 PM to 1 PM)
        if (endDateTime <= startDateTime) {
          // Add one day to the end date
          endDateTime = new Date(endDateTime)
          endDateTime.setDate(endDateTime.getDate() + 1)
        }
        
        startISO = startDateTime.toISOString()
        endISO = endDateTime.toISOString()
      }

      const payload: any = {
        title: formData.title,
        description: formData.description,
        startUTC: startISO,
        endUTC: endISO,
        location: formData.location,
        color: formData.color,
        scope: formData.scope,
        important: formData.important,
      }

      // Only include rsvpEnabled for CLUB and TEAM events
      if (formData.scope === 'CLUB' || formData.scope === 'TEAM') {
        payload.rsvpEnabled = formData.rsvpEnabled
      }

      if (formData.scope === 'TEAM') {
        payload.teamId = formData.teamId || null
      } else {
        payload.teamId = null
      }

      const response = await fetch(`/api/calendar/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update event')
      }

      toast({
        title: 'Event updated',
        description: formData.title,
      })

      setEditOpen(false)
      setEventDetailsOpen(false)
      setSelectedEvent(null)
      setFormData(getInitialFormData())
      fetchEvents()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update event',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (eventId: string) => {
    setEventToDelete(eventId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!eventToDelete) return

    try {
      const response = await fetch(`/api/calendar/${eventToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete event')
      }

      toast({
        title: 'Event deleted',
        description: 'The calendar event has been removed',
      })

      setEventDetailsOpen(false)
      setSelectedEvent(null)
      fetchEvents()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete event',
        variant: 'destructive',
      })
    } finally {
      setDeleteDialogOpen(false)
      setEventToDelete(null)
    }
  }

  const canEditEvent = (event: any) => {
    // Only the creator can edit their own events
    return event.creatorId === currentMembership.id
  }

  const canDeleteEvent = (event: any) => {
    // User can delete their own events
    if (event.creatorId === currentMembership.id) return true
    // Admins can delete any team/club events (not personal events made by others)
    if (isAdmin && event.scope !== 'PERSONAL') return true
    return false
  }

  const getScopeBadge = (event: any) => {
    switch (event.scope) {
      case 'TEAM':
        return <Badge variant="default" className="text-xs">CLUB</Badge>
      case 'TEAM':
        return <Badge variant="secondary" className="text-xs">{event.team?.name || 'TEAM'}</Badge>
      case 'PERSONAL':
        return <Badge variant="outline" className="text-xs">PERSONAL</Badge>
    }
  }

  const getEventColor = (event: any) => {
    // Use custom color if available, otherwise fall back to scope-based colors
    if (event.color) {
      return ''  // We'll use inline styles instead
    }
    
    switch (event.scope) {
      case 'TEAM':
        return 'bg-blue-500 hover:bg-blue-600 text-white'
      case 'TEAM':
        return 'bg-purple-500 hover:bg-purple-600 text-white'
      case 'PERSONAL':
        return 'bg-green-500 hover:bg-green-600 text-white'
      default:
        return 'bg-gray-500 hover:bg-gray-600 text-white'
    }
  }
  
  const getContrastingColor = (hexColor: string) => {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16)
    const g = parseInt(hexColor.slice(3, 5), 16)
    const b = parseInt(hexColor.slice(5, 7), 16)
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // If the color is dark (low luminance), use a light contrasting color
    // If the color is light (high luminance), use a dark contrasting color
    if (luminance < 0.5) {
      // Dark colors - use yellow for high contrast
      return '#eab308' // yellow-500
    } else {
      // Light colors - use red for high contrast
      return '#ef4444' // red-500
    }
  }
  
  const getEventStyle = (event: any) => {
    const style: any = {}
    if (event.color) {
      style.backgroundColor = event.color
      style.color = '#ffffff'
    }
    if (event.important) {
      // Always use red outline for important events
      style.border = `2px solid #ef4444` // red-500
      style.borderRadius = '4px'
    }
    return style
  }
  
  const getImportantBorderColor = (event: any) => {
    // Always use red border for important events
    return 'border-red-500'
  }

  // Calendar generation functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month, 1).getDay()
  }

  const getMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const getWeekDates = (date: Date) => {
    const day = date.getDay()
    const diff = date.getDate() - day
    const sunday = new Date(date)
    sunday.setDate(diff)
    
    const week = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday)
      day.setDate(sunday.getDate() + i)
      week.push(day)
    }
    return week
  }

  const getWeekRange = (date: Date) => {
    const weekDates = getWeekDates(date)
    const start = weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const end = weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${start} - ${end}`
  }

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    )
  }

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      // Apply important filter if enabled
      if (showImportantOnly && !event.important) {
        return false
      }
      
      const eventStart = new Date(event.startUTC)
      const eventEnd = new Date(event.endUTC)
      
      // Normalize dates to just the date part (no time) for comparison
      const eventStartDate = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate())
      const eventEndDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate())
      const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      
      // Check if the date falls within the event's date range
      return currentDate >= eventStartDate && currentDate <= eventEndDate
    }).sort((a, b) => {
      const aStart = new Date(a.startUTC)
      const aEnd = new Date(a.endUTC)
      const bStart = new Date(b.startUTC)
      const bEnd = new Date(b.endUTC)
      
      // Check if events are all-day
      const aIsAllDay = aStart.getHours() === 0 && aStart.getMinutes() === 0 && 
                        aEnd.getHours() === 23 && aEnd.getMinutes() === 59
      const bIsAllDay = bStart.getHours() === 0 && bStart.getMinutes() === 0 && 
                        bEnd.getHours() === 23 && bEnd.getMinutes() === 59
      
      // Calculate duration in days (fix: use proper date difference)
      const aDuration = Math.ceil((aEnd.getTime() - aStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      const bDuration = Math.ceil((bEnd.getTime() - bStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      
      // Check if events are multi-day
      const aIsMultiDay = aDuration > 1
      const bIsMultiDay = bDuration > 1
      
      // Prioritize multi-day events over single-day events
      if (aIsMultiDay && !bIsMultiDay) return -1
      if (!aIsMultiDay && bIsMultiDay) return 1
      
      // If both are multi-day, prioritize longer duration
      if (aIsMultiDay && bIsMultiDay && aDuration !== bDuration) {
        return bDuration - aDuration
      }
      
      // If both are single-day, prioritize all-day events
      if (!aIsMultiDay && !bIsMultiDay) {
        if (aIsAllDay && !bIsAllDay) return -1
        if (!aIsAllDay && bIsAllDay) return 1
      }
      
      // For same duration or same type, sort by start time
      return aStart.getTime() - bStart.getTime()
    })
  }

  const navigatePrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() - 7)
      setCurrentDate(newDate)
    }
  }

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else {
      const newDate = new Date(currentDate)
      newDate.setDate(newDate.getDate() + 7)
      setCurrentDate(newDate)
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleDayClick = (date: Date) => {
    setFormData(getInitialFormData(date))
    setCreateOpen(true)
  }

  const handleEventClick = (event: any) => {
    setSelectedEvent(event)
    setEventDetailsOpen(true)
  }

  const handleEditClick = (event: any) => {
    setSelectedEvent(event)
    
    const startDate = new Date(event.startUTC)
    const endDate = new Date(event.endUTC)
    
    // Check if it's an all-day event (starts at 00:00 and ends at 23:59)
    const isAllDay = startDate.getHours() === 0 && startDate.getMinutes() === 0 && 
                     endDate.getHours() === 23 && endDate.getMinutes() === 59
    
    // Helper function to format date as YYYY-MM-DD in local timezone
    const formatDateLocal = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    setFormData({
      title: event.title,
      description: event.description || '',
      date: formatDateLocal(startDate),
      startTime: isAllDay ? '09:00' : startDate.toTimeString().slice(0, 5),
      endTime: isAllDay ? '17:00' : endDate.toTimeString().slice(0, 5),
      isAllDay: isAllDay,
      startDate: formatDateLocal(startDate),
      endDate: formatDateLocal(endDate),
      location: event.location || '',
      color: event.color || '#3b82f6', // Preserve existing color or default to blue
      rsvpEnabled: event.rsvpEnabled !== undefined ? event.rsvpEnabled : true,
      important: event.important || false,
      scope: event.scope,
      teamId: event.teamId || '',
      attendeeId: event.attendeeId || currentMembership.id,
      targetRoles: event.targetRoles || [],
      targetEvents: event.targetEvents || [],
      isRecurring: false,
      recurrenceRule: 'WEEKLY' as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
      recurrenceInterval: 1,
      recurrenceDaysOfWeek: [] as number[],
      recurrenceEndType: 'date' as 'date' | 'count',
      recurrenceEndDate: formatDateLocal(new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)),
      recurrenceCount: 10,
    })
    setEventDetailsOpen(false)
    setEditOpen(true)
  }

  const handleRSVP = async (eventId: string, status: 'YES' | 'NO') => {
    setRsvping(true)
    
    // Optimistic update
    const currentEvent = events.find(e => e.id === eventId)
    if (currentEvent) {
      const optimisticEvents = events.map(e => {
        if (e.id === eventId) {
          const existingRsvp = e.rsvps?.find((r: any) => r.userId === user.id)
          const newRsvps = existingRsvp
            ? e.rsvps.map((r: any) => r.userId === user.id ? { ...r, status } : r)
            : [...(e.rsvps || []), { id: 'temp', userId: user.id, status, user }]
          return { ...e, rsvps: newRsvps }
        }
        return e
      })
      setEvents(optimisticEvents)
      
      // Update selected event if it's the one being RSVP'd
      if (selectedEvent?.id === eventId) {
        const updatedEvent = optimisticEvents.find(e => e.id === eventId)
        if (updatedEvent) setSelectedEvent(updatedEvent)
      }
    }

    try {
      const response = await fetch(`/api/calendar/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error('Failed to RSVP')
      }

      // Refresh events to get accurate data
      await fetchEvents()
      
      toast({
        title: status === 'YES' ? 'RSVP: Going' : 'RSVP: Not Going',
      })
    } catch (error) {
      // Revert optimistic update on error
      await fetchEvents()
      toast({
        title: 'Error',
        description: 'Failed to update RSVP',
        variant: 'destructive',
      })
    } finally {
      setRsvping(false)
    }
  }

  const handleRemoveRSVP = async (eventId: string) => {
    setRsvping(true)
    
    // Optimistic update
    const optimisticEvents = events.map(e => {
      if (e.id === eventId) {
        return { ...e, rsvps: e.rsvps?.filter((r: any) => r.userId !== user.id) || [] }
      }
      return e
    })
    setEvents(optimisticEvents)
    
    // Update selected event if it's the one being updated
    if (selectedEvent?.id === eventId) {
      const updatedEvent = optimisticEvents.find(e => e.id === eventId)
      if (updatedEvent) setSelectedEvent(updatedEvent)
    }

    try {
      const response = await fetch(`/api/calendar/${eventId}/rsvp`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove RSVP')
      }

      // Refresh events to get accurate data
      await fetchEvents()
      
      toast({
        title: 'RSVP removed',
      })
    } catch (error) {
      // Revert optimistic update on error
      await fetchEvents()
      toast({
        title: 'Error',
        description: 'Failed to remove RSVP',
        variant: 'destructive',
      })
    } finally {
      setRsvping(false)
    }
  }

  const getUserRSVP = (event: any) => {
    return event.rsvps?.find((r: any) => r.userId === user.id)
  }

  const getRSVPCounts = (event: any) => {
    const yesCount = event.rsvps?.filter((r: any) => r.status === 'YES').length || 0
    const noCount = event.rsvps?.filter((r: any) => r.status === 'NO').length || 0
    return { yesCount, noCount }
  }

  const handleAnnouncementConfirm = async (postToStream: boolean, sendEmail: boolean) => {
    if (!postToStream || !createdEvent) return

    try {
      // Content is just the event description - time/date/location will be pulled from calendarEvent
      const content = createdEvent.description || 'Event details coming soon!'

      // Determine scope and team IDs based on the event
      const scope = createdEvent.scope === 'CLUB' ? 'CLUB' : 'TEAM'
      const teamIds = createdEvent.scope === 'TEAM' && createdEvent.teamId 
        ? [createdEvent.teamId] 
        : undefined

      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          title: createdEvent.title,
          content,
          scope,
          teamIds,
          sendEmail,
          calendarEventId: createdEvent.id,
          important: createdEvent.important || false,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create announcement')
      }

      toast({
        title: 'Posted to stream',
        description: sendEmail ? 'Email notifications are being sent.' : undefined,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to post to stream',
        variant: 'destructive',
      })
    } finally {
      setCreatedEvent(null)
    }
  }


  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []
    const today = new Date()

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="min-h-[120px] border border-border bg-muted/20" />
      )
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      const dayEvents = getEventsForDay(date)
      const isToday = isSameDay(date, today)

      days.push(
        <div
          key={day}
          className="min-h-[120px] border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors p-2"
          onClick={() => handleDayClick(date)}
        >
          <div className="text-sm font-semibold mb-1">
            <span className={`${isToday ? 'bg-primary text-primary-foreground rounded-full px-2 py-1' : ''}`}>
              {day}
            </span>
          </div>
          <div className="space-y-1 max-h-[100px] overflow-y-auto">
            {dayEvents.map((event) => {
              const eventStart = new Date(event.startUTC)
              const eventEnd = new Date(event.endUTC)
              const isMultiDay = !isSameDay(eventStart, eventEnd)
              const isStartDay = isSameDay(eventStart, date)
              const isEndDay = isSameDay(eventEnd, date)
              
              return (
                <div
                  key={event.id}
                  className={`text-xs p-1 rounded truncate relative ${getEventColor(event)} ${event.color ? 'text-white' : ''} cursor-pointer ${
                    isMultiDay 
                      ? isStartDay 
                        ? 'rounded-l-md rounded-r-none border-r-2 border-r-white/30' 
                        : isEndDay 
                          ? 'rounded-r-md rounded-l-none border-l-2 border-l-white/30' 
                          : 'rounded-none border-x-2 border-x-white/30'
                      : 'rounded'
                  }`}
                  style={getEventStyle(event)}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEventClick(event)
                  }}
                >
                  {(() => {
                    // Check if it's an all-day event
                    const isAllDay = eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && 
                                     eventEnd.getHours() === 23 && eventEnd.getMinutes() === 59
                    
                    if (isAllDay) {
                      // For all-day events, just show the title with continuation indicators
                      return (
                        <div className="flex items-center justify-between gap-1">
                          {!isStartDay && <span className="mr-1">←</span>}
                          {event.testId && <FileText className="h-3 w-3 flex-shrink-0" />}
                          <span className="truncate flex-1">
                            {event.title}
                          </span>
                          {!isEndDay && <span className="ml-1">→</span>}
                        </div>
                      )
                    }
                    
                    // For regular events, show time logic
                    if (isMultiDay) {
                      return (
                        <div className="flex items-center justify-between gap-1">
                          {!isStartDay && <span className="mr-1">←</span>}
                          {event.testId && <FileText className="h-3 w-3 flex-shrink-0" />}
                          <span className="truncate flex-1">
                            {isStartDay && (
                              <>
                                {eventStart.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })} {event.title}
                              </>
                            )}
                            {!isStartDay && !isEndDay && (
                              <>{event.title}</>
                            )}
                            {isEndDay && (
                              <>
                                {event.title} {eventEnd.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </>
                            )}
                          </span>
                          {!isEndDay && <span className="ml-1">→</span>}
                        </div>
                      )
                    } else {
                      return (
                        <div className="flex items-center gap-1">
                          {event.testId && <FileText className="h-3 w-3 flex-shrink-0" />}
                          <span>
                            {eventStart.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })} {event.title}
                          </span>
                        </div>
                      )
                    }
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-7 gap-0 border rounded-lg overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="bg-muted p-2 text-center font-semibold text-sm border-b border-border">
            {day}
          </div>
        ))}
        {days}
      </div>
    )
  }

  // Helper function to calculate overlapping event layouts (Google Calendar style)
  const calculateEventLayout = (events: any[]) => {
    if (events.length === 0) return []
    
    // Convert events to intervals with start/end times in minutes
    const intervals = events.map(event => {
      const start = new Date(event.startUTC)
      const end = new Date(event.endUTC)
      return {
        event,
        startMinutes: start.getHours() * 60 + start.getMinutes(),
        endMinutes: end.getHours() * 60 + end.getMinutes()
      }
    })
    
    // Sort by start time, then by duration (longer first)
    intervals.sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes
      }
      return (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes)
    })
    
    // Calculate columns for overlapping events
    const columns: any[][] = []
    const eventLayouts: Map<string, { column: number, totalColumns: number }> = new Map()
    
    intervals.forEach(interval => {
      // Find the first column where this event fits
      let placed = false
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex]
        const lastEvent = column[column.length - 1]
        
        // Check if this event starts after the last event in this column ends
        if (interval.startMinutes >= lastEvent.endMinutes) {
          column.push(interval)
          placed = true
          break
        }
      }
      
      // If no suitable column found, create a new one
      if (!placed) {
        columns.push([interval])
      }
    })
    
    // Calculate the total number of overlapping columns for each event
    intervals.forEach(interval => {
      // Find which column this event is in
      let eventColumn = 0
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        if (columns[colIndex].some(e => e.event.id === interval.event.id)) {
          eventColumn = colIndex
          break
        }
      }
      
      // Count how many events overlap with this one at any point in time
      let maxOverlap = 1
      intervals.forEach(other => {
        if (other.event.id === interval.event.id) return
        
        // Check if they overlap
        if (interval.startMinutes < other.endMinutes && interval.endMinutes > other.startMinutes) {
          maxOverlap++
        }
      })
      
      eventLayouts.set(interval.event.id, {
        column: eventColumn,
        totalColumns: maxOverlap
      })
    })
    
    return events.map(event => {
      const layout = eventLayouts.get(event.id) || { column: 0, totalColumns: 1 }
      return {
        event,
        column: layout.column,
        totalColumns: layout.totalColumns
      }
    })
  }

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate)
    const today = new Date()
    const hours = Array.from({ length: 24 }, (_, i) => i)

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-8 gap-0">
          <div className="bg-muted py-1 px-1 border-b border-r border-border" />
          {weekDates.map((date) => {
            const isToday = isSameDay(date, today)
            return (
              <div
                key={date.toISOString()}
                className={`bg-muted py-1 px-2 text-center border-b border-border ${isToday ? 'bg-primary/10' : ''}`}
              >
                <div className="text-xs font-medium text-muted-foreground">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-base font-semibold ${isToday ? 'text-primary' : ''}`}>
                  {date.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* All-day events section */}
        <div className="grid grid-cols-8 gap-0 border-b border-border">
          <div className="py-1 px-1 text-xs text-muted-foreground text-right border-r border-border leading-tight flex items-center justify-end">
            All Day
          </div>
          {weekDates.map((date) => {
            const allDayEvents = events.filter((event) => {
              // Apply important filter if enabled
              if (showImportantOnly && !event.important) {
                return false
              }
              
              const eventStart = new Date(event.startUTC)
              const eventEnd = new Date(event.endUTC)
              
              // Check if it's an all-day event
              const isAllDay = eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && 
                              eventEnd.getHours() === 23 && eventEnd.getMinutes() === 59
              
              if (!isAllDay) return false
              
              // Normalize dates for comparison
              const eventStartDate = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate())
              const eventEndDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate())
              const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
              
              // Show on all days it spans
              return currentDate >= eventStartDate && currentDate <= eventEndDate
            }).sort((a, b) => {
              const aStart = new Date(a.startUTC)
              const aEnd = new Date(a.endUTC)
              const bStart = new Date(b.startUTC)
              const bEnd = new Date(b.endUTC)
              
              // Calculate duration in days (fix: use proper end date and add 1)
              const aDuration = Math.ceil((aEnd.getTime() - aStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
              const bDuration = Math.ceil((bEnd.getTime() - bStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
              
              // Check if events are multi-day
              const aIsMultiDay = aDuration > 1
              const bIsMultiDay = bDuration > 1
              
              // Prioritize multi-day events over single-day events
              if (aIsMultiDay && !bIsMultiDay) return -1
              if (!aIsMultiDay && bIsMultiDay) return 1
              
              // If both are multi-day, prioritize longer duration
              if (aIsMultiDay && bIsMultiDay && aDuration !== bDuration) {
                return bDuration - aDuration
              }
              
              // For same duration or same type, sort by start time
              return aStart.getTime() - bStart.getTime()
            })

            return (
              <div
                key={date.toISOString()}
                className="min-h-[40px] border-r border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors p-1"
                onClick={() => {
                  const allDayDate = new Date(date)
                  allDayDate.setHours(0, 0, 0, 0)
                  setFormData(getInitialFormData(allDayDate, true))
                  setCreateOpen(true)
                }}
              >
                <div className="space-y-1">
                  {allDayEvents.map((event) => {
                    const eventStart = new Date(event.startUTC)
                    const eventEnd = new Date(event.endUTC)
                    const isMultiDay = !isSameDay(eventStart, eventEnd)
                    const isStartDay = isSameDay(eventStart, date)
                    const isEndDay = isSameDay(eventEnd, date)
                    
                    return (
                      <div
                        key={event.id}
                        className={`text-xs p-1 rounded cursor-pointer relative ${getEventColor(event)} ${event.color ? 'text-white' : ''} ${
                          isMultiDay 
                            ? isStartDay 
                              ? 'rounded-l-md rounded-r-none border-r-2 border-r-white/30' 
                              : isEndDay 
                                ? 'rounded-r-md rounded-l-none border-l-2 border-l-white/30' 
                                : 'rounded-none border-x-2 border-x-white/30'
                            : ''
                        }`}
                        style={getEventStyle(event)}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEventClick(event)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          {isMultiDay && !isStartDay && <span className="mr-1">←</span>}
                          <span className="truncate flex-1">
                            {event.title}
                          </span>
                          {isMultiDay && !isEndDay && <span className="ml-1">→</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time slots */}
        <div>
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 gap-0">
              <div className="py-1 px-1 text-xs text-muted-foreground text-right border-r border-border leading-tight flex items-center justify-end">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {weekDates.map((date) => {
                const slotDate = new Date(date)
                slotDate.setHours(hour, 0, 0, 0)
                const slotEvents = events.filter((event) => {
                  // Apply important filter if enabled
                  if (showImportantOnly && !event.important) {
                    return false
                  }
                  
                  const eventStart = new Date(event.startUTC)
                  const eventEnd = new Date(event.endUTC)
                  
                  // Exclude all-day events (they're shown in the all-day section)
                  const isAllDay = eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && 
                                  eventEnd.getHours() === 23 && eventEnd.getMinutes() === 59
                  if (isAllDay) return false
                  
                  // Normalize dates for comparison
                  const eventStartDate = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate())
                  const eventEndDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate())
                  const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
                  
                  // For multi-day events, show them on all days they span
                  // For single-day events, only show in the start hour slot (will span with CSS)
                  if (isSameDay(eventStart, eventEnd)) {
                    // Single day event - only show in start hour slot
                    return isSameDay(eventStart, date) && eventStart.getHours() === hour
                  } else {
                    // Multi-day event - show on all days it spans
                    return currentDate >= eventStartDate && currentDate <= eventEndDate
                  }
                }).sort((a, b) => {
                  const aStart = new Date(a.startUTC)
                  const aEnd = new Date(a.endUTC)
                  const bStart = new Date(b.startUTC)
                  const bEnd = new Date(b.endUTC)
                  
                  // Check if events are all-day
                  const aIsAllDay = aStart.getHours() === 0 && aStart.getMinutes() === 0 && 
                                    aEnd.getHours() === 23 && aEnd.getMinutes() === 59
                  const bIsAllDay = bStart.getHours() === 0 && bStart.getMinutes() === 0 && 
                                    bEnd.getHours() === 23 && bEnd.getMinutes() === 59
                  
                  // Calculate duration in days
                  const aDuration = Math.ceil((aEnd.getTime() - aStart.getTime()) / (1000 * 60 * 60 * 24))
                  const bDuration = Math.ceil((bEnd.getTime() - bStart.getTime()) / (1000 * 60 * 60 * 24))
                  
                  // Prioritize all-day events
                  if (aIsAllDay && !bIsAllDay) return -1
                  if (!aIsAllDay && bIsAllDay) return 1
                  
                  // If both are all-day, prioritize longer duration
                  if (aIsAllDay && bIsAllDay) {
                    if (aDuration !== bDuration) return bDuration - aDuration
                  }
                  
                  // For regular events or same duration all-day events, sort by start time
                  return aStart.getTime() - bStart.getTime()
                })

                // Calculate event layouts for overlapping events
                const eventLayouts = calculateEventLayout(slotEvents)
                
                return (
                  <div
                    key={`${date.toISOString()}-${hour}`}
                    className="min-h-[35px] border-b border-r border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors relative"
                    style={{ padding: 0 }}
                    onClick={() => handleDayClick(slotDate)}
                  >
                    {eventLayouts.map(({ event, column, totalColumns }) => {
                      const eventStart = new Date(event.startUTC)
                      const eventEnd = new Date(event.endUTC)
                      const isMultiDay = !isSameDay(eventStart, eventEnd)
                      const isStartDay = isSameDay(eventStart, date)
                      const isEndDay = isSameDay(eventEnd, date)
                      
                      // Calculate event duration in minutes for single-day events
                      const eventDurationMinutes = isSameDay(eventStart, eventEnd) 
                        ? (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60) // Convert to minutes
                        : 60 // Default to 1 hour for multi-day events
                      
                      // Calculate precise height based on actual duration (35px per hour)
                      // Use much smaller minimum for very short events
                      let eventHeight: number
                      if (eventDurationMinutes < 5) {
                        eventHeight = 8 // Very thin line for 1-4 minute events
                      } else if (eventDurationMinutes < 15) {
                        eventHeight = 12 // Small line for 5-14 minute events
                      } else {
                        eventHeight = Math.max((eventDurationMinutes / 60) * 35, 16) // Proportional for longer events
                      }
                      
                      // Determine font size and layout based on height
                      let fontSize: string
                      let layout: 'compact' | 'normal' | 'minimal'
                      
                      if (eventHeight < 15) {
                        fontSize = 'text-[7px]'
                        layout = 'minimal'
                      } else if (eventHeight < 25) {
                        fontSize = 'text-[8px]'
                        layout = 'compact'
                      } else {
                        fontSize = 'text-[10px]'
                        layout = 'normal'
                      }
                      
                      // Calculate equal division of space - perfectly flush events
                      // Each event gets equal width: 100% / totalColumns
                      // Event 1: 0% to 50% (if 2 events)
                      // Event 2: 50% to 100% (if 2 events)
                      // Event 1: 0% to 33%, Event 2: 33% to 66%, Event 3: 66% to 100% (if 3 events)
                      const widthPercent = 100 / totalColumns
                      const leftPercent = (column * 100) / totalColumns
                      
                      return (
                        <div
                          key={event.id}
                          className={`relative ${getEventColor(event)} ${event.color ? 'text-white' : ''} cursor-pointer overflow-hidden ${
                            isMultiDay 
                              ? isStartDay 
                                ? 'rounded-l-md rounded-r-none' 
                                : isEndDay 
                                  ? 'rounded-r-md rounded-l-none' 
                                  : ''
                              : totalColumns === 1 ? 'rounded' : column === 0 ? 'rounded-l' : column === totalColumns - 1 ? 'rounded-r' : ''
                          }`}
                          style={{
                            ...getEventStyle(event),
                            height: `${eventHeight}px`,
                            minHeight: `${eventHeight}px`,
                            position: 'absolute',
                            top: '0',
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            zIndex: 10 + column,
                            padding: '2px 4px',
                            margin: 0,
                            boxShadow: totalColumns > 1 && column < totalColumns - 1 ? 'inset -1px 0 0 rgba(255,255,255,0.3)' : 'none'
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEventClick(event)
                          }}
                        >
                          {(() => {
                            const eventStart = new Date(event.startUTC)
                            const eventEnd = new Date(event.endUTC)
                            
                            // Check if it's an all-day event
                            const isAllDay = eventStart.getHours() === 0 && eventStart.getMinutes() === 0 && 
                                             eventEnd.getHours() === 23 && eventEnd.getMinutes() === 59
                            
                            if (isAllDay) {
                              // For all-day events, just show title
                              return (
                                <div className={`font-semibold truncate ${fontSize} leading-tight flex items-center gap-1`}>
                                  {isMultiDay && !isStartDay && <span className="mr-1">←</span>}
                                  {event.testId && <FileText className="h-3 w-3 flex-shrink-0" />}
                                  <span className="truncate">
                                    {event.title}
                                  </span>
                                  {isMultiDay && !isEndDay && <span className="ml-1">→</span>}
                                </div>
                              )
                            }
                            
                            // For regular events, show time logic
                            if (isMultiDay && !isStartDay) {
                              // For middle days of multi-day events, don't show time
                              return (
                                <div className={`font-semibold truncate ${fontSize} leading-tight flex items-center gap-1`}>
                                  <span className="mr-1">←</span>
                                  {event.testId && <FileText className="h-2.5 w-2.5 flex-shrink-0" />}
                                  <span className="truncate">
                                    {event.title}
                                  </span>
                                  {!isEndDay && <span className="ml-1">→</span>}
                                </div>
                              )
                            } else {
                              // Show start - end time format
                              const startTime = eventStart.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })
                              const endTime = eventEnd.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })
                              
                              if (layout === 'minimal') {
                                // For very short events, show only title
                                return (
                                  <div className={`font-semibold truncate ${fontSize} leading-tight flex items-center gap-1`} title={event.title}>
                                    {event.testId && <FileText className="h-2.5 w-2.5 flex-shrink-0" />}
                                    <span className="truncate">
                                      {event.title}
                                    </span>
                                    {isMultiDay && !isEndDay && <span className="ml-1">→</span>}
                                  </div>
                                )
                              } else {
                                // For all other events, put title and time on same line
                                return (
                                  <div className={`${fontSize} leading-tight flex items-center gap-1 overflow-hidden`}>
                                    {event.testId && <FileText className="h-3 w-3 flex-shrink-0" />}
                                    <span className="font-semibold truncate flex-shrink min-w-0" title={event.title}>
                                      {event.title}
                                    </span>
                                    <span className="opacity-90 whitespace-nowrap flex-shrink-0" title={`${startTime} - ${endTime}`}>
                                      {startTime} - {endTime}
                                    </span>
                                    {isMultiDay && !isEndDay && <span className="ml-1">→</span>}
                                  </div>
                                )
                              }
                            }
                          })()}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <Button variant="outline" size="sm" onClick={goToToday} className="text-xs sm:text-sm">
            Today
          </Button>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrevious} className="h-8 w-8 sm:h-10 sm:w-10">
              <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={navigateNext} className="h-8 w-8 sm:h-10 sm:w-10">
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold">
            {viewMode === 'month' ? getMonthYear(currentDate) : getWeekRange(currentDate)}
          </h2>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="rounded-none text-xs sm:text-sm"
            >
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="rounded-none text-xs sm:text-sm"
            >
              Week
            </Button>
          </div>
          <Button
            variant={showImportantOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowImportantOnly(!showImportantOnly)}
            className="text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">Important Only</span>
            <span className="sm:hidden">Important</span>
          </Button>
          <Button onClick={() => {
            setFormData(getInitialFormData())
            setCreateOpen(true)
          }} size="sm" className="text-xs sm:text-sm">
            <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">New Event</span>
            <span className="sm:hidden">Event</span>
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {loading ? (
        <PageLoading
          title="Loading calendar"
          description="Fetching your events and schedule..."
          variant="orbit"
        />
      ) : viewMode === 'month' ? (
        renderMonthView()
      ) : (
        renderWeekView()
      )}

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create Calendar Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Event name"
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Add details about this event..."
                    className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {/* Date & Time Section */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Date & Time</h4>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      id="isAllDay"
                      checked={formData.isAllDay}
                      onCheckedChange={(checked) => setFormData({ ...formData, isAllDay: checked as boolean })}
                    />
                    <span className="text-sm">All day</span>
                  </label>
                </div>
                
                {formData.isAllDay ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="startDate" className="text-xs text-muted-foreground">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="endDate" className="text-xs text-muted-foreground">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="date" className="text-xs text-muted-foreground">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="startTime" className="text-xs text-muted-foreground">Start Time</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="endTime" className="text-xs text-muted-foreground">End Time</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          required
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recurrence Section */}
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id="isRecurring"
                    checked={formData.isRecurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked as boolean })}
                  />
                  <span className="text-sm font-medium">Repeat event</span>
                </label>

                {formData.isRecurring && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    {/* Frequency and Interval */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Repeats</Label>
                      <div className="flex items-center gap-3">
                        <select
                          value={formData.recurrenceRule}
                          onChange={(e) => setFormData({ ...formData, recurrenceRule: e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY', recurrenceDaysOfWeek: [] })}
                          className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="YEARLY">Yearly</option>
                        </select>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm text-muted-foreground whitespace-nowrap">every</span>
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={formData.recurrenceInterval}
                            onChange={(e) => setFormData({ ...formData, recurrenceInterval: parseInt(e.target.value) || 1 })}
                            className="w-16 text-center"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Days of Week (Weekly only) */}
                    {formData.recurrenceRule === 'WEEKLY' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">On days</Label>
                        <div className="flex gap-1.5 justify-between">
                          {[
                            { label: 'S', full: 'Sunday', index: 0 },
                            { label: 'M', full: 'Monday', index: 1 },
                            { label: 'T', full: 'Tuesday', index: 2 },
                            { label: 'W', full: 'Wednesday', index: 3 },
                            { label: 'T', full: 'Thursday', index: 4 },
                            { label: 'F', full: 'Friday', index: 5 },
                            { label: 'S', full: 'Saturday', index: 6 },
                          ].map(({ label, full, index }) => {
                            const isSelected = (formData.recurrenceDaysOfWeek || []).includes(index)
                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  const days = formData.recurrenceDaysOfWeek || []
                                  const newDays = days.includes(index)
                                    ? days.filter(d => d !== index)
                                    : [...days, index].sort((a, b) => a - b)
                                  setFormData({ ...formData, recurrenceDaysOfWeek: newDays })
                                }}
                                className={`flex-1 h-9 rounded-md text-xs font-semibold transition-all hover:scale-105 ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-background border border-input hover:bg-accent hover:border-primary/50'
                                }`}
                                title={full}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                        {(formData.recurrenceDaysOfWeek || []).length === 0 && (
                          <p className="text-xs text-muted-foreground">Select at least one day</p>
                        )}
                      </div>
                    )}

                    {/* End Condition */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Ends</Label>
                      <RadioGroup
                        value={formData.recurrenceEndType}
                        onValueChange={(value) => setFormData({ ...formData, recurrenceEndType: value as 'date' | 'count' })}
                        className="space-y-2"
                      >
                        <div className="flex items-center gap-3 p-2 rounded-md border border-transparent hover:bg-accent/50 transition-colors">
                          <RadioGroupItem value="date" id="end-date" />
                          <Label htmlFor="end-date" className="cursor-pointer font-normal text-sm flex-1 flex items-center gap-2">
                            <span className="whitespace-nowrap">On date:</span>
                            {formData.recurrenceEndType === 'date' && (
                              <Input
                                type="date"
                                value={formData.recurrenceEndDate}
                                onChange={(e) => setFormData({ ...formData, recurrenceEndDate: e.target.value })}
                                className="flex-1 max-w-[180px]"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                          </Label>
                        </div>
                        <div className="flex items-center gap-3 p-2 rounded-md border border-transparent hover:bg-accent/50 transition-colors">
                          <RadioGroupItem value="count" id="end-count" />
                          <Label htmlFor="end-count" className="cursor-pointer font-normal text-sm flex-1 flex items-center gap-2">
                            <span className="whitespace-nowrap">After:</span>
                            {formData.recurrenceEndType === 'count' && (
                              <Input
                                type="number"
                                min="1"
                                max="999"
                                value={formData.recurrenceCount}
                                onChange={(e) => setFormData({ ...formData, recurrenceCount: parseInt(e.target.value) || 1 })}
                                className="w-20"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <span className="whitespace-nowrap">occurrence{formData.recurrenceCount !== 1 ? 's' : ''}</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Summary Preview */}
                    <div className="pt-3 border-t border-border/50">
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-foreground mb-0.5">Preview</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {formData.recurrenceInterval > 1 ? `Every ${formData.recurrenceInterval} ` : 'Every '}
                            {formData.recurrenceRule === 'DAILY' ? (formData.recurrenceInterval > 1 ? 'days' : 'day') :
                             formData.recurrenceRule === 'WEEKLY' ? (formData.recurrenceInterval > 1 ? 'weeks' : 'week') :
                             formData.recurrenceRule === 'MONTHLY' ? (formData.recurrenceInterval > 1 ? 'months' : 'month') :
                             (formData.recurrenceInterval > 1 ? 'years' : 'year')}
                            {formData.recurrenceRule === 'WEEKLY' && formData.recurrenceDaysOfWeek && formData.recurrenceDaysOfWeek.length > 0 && 
                              ` on ${formData.recurrenceDaysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`}
                            {formData.recurrenceRule === 'WEEKLY' && (!formData.recurrenceDaysOfWeek || formData.recurrenceDaysOfWeek.length === 0) && ' (select days)'}
                            {formData.recurrenceEndType === 'date' 
                              ? ` until ${new Date(formData.recurrenceEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                              : ` for ${formData.recurrenceCount} occurrence${formData.recurrenceCount !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Location & Appearance */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location" className="text-sm font-medium">Location <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Where is this happening?"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="color" className="text-sm font-medium">Color</Label>
                  <div className="flex gap-2 mt-1.5">
                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 ${formData.color === color ? 'border-foreground ring-2 ring-offset-2 ring-foreground/20' : 'border-border'}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Visibility Section */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h4 className="text-sm font-semibold">Visibility</h4>
                <RadioGroup 
                  value={formData.scope} 
                  onValueChange={(value) => setFormData({ ...formData, scope: value as 'PERSONAL' | 'TEAM' | 'CLUB', teamId: '' })}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="PERSONAL" id="scope-personal" />
                    <Label htmlFor="scope-personal" className="cursor-pointer font-normal text-sm">
                      Personal event (only you can see)
                    </Label>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="CLUB" id="scope-club" />
                        <Label htmlFor="scope-club" className="cursor-pointer font-normal text-sm">
                          Entire club
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="TEAM" id="scope-team" />
                        <Label htmlFor="scope-team" className="cursor-pointer font-normal text-sm">
                          Specific team
                        </Label>
                      </div>
                    </>
                  )}
                </RadioGroup>
                {formData.scope === 'TEAM' && (
                  <div className="pt-2">
                    <Label htmlFor="team" className="text-xs text-muted-foreground">Select Team</Label>
                    <select
                      id="team"
                      value={formData.teamId}
                      onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                      required
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select a team...</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(formData.scope === 'CLUB' || formData.scope === 'TEAM') && (
                  <div className="pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        id="rsvp-enabled"
                        checked={formData.rsvpEnabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, rsvpEnabled: checked as boolean })}
                      />
                      <span className="text-sm">Enable RSVP tracking</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id="important"
                    checked={formData.important}
                    onCheckedChange={(checked) => setFormData({ ...formData, important: checked as boolean })}
                  />
                  <span className="text-sm font-medium">Mark as important</span>
                </label>
              </div>

              {/* Advanced Targeting - Collapsible */}
              {isAdmin && (formData.scope === 'CLUB' || formData.scope === 'TEAM') && (
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
                              id={`calendar-role-${role}`}
                              checked={formData.targetRoles.includes(role)}
                              onCheckedChange={(checked) => {
                                const newRoles = checked
                                  ? [...formData.targetRoles, role]
                                  : formData.targetRoles.filter((r: string) => r !== role)
                                setFormData({ ...formData, targetRoles: newRoles })
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
                              id={`calendar-event-${event.id}`}
                              checked={formData.targetEvents.includes(event.id)}
                              onCheckedChange={(checked) => {
                                const newEvents = checked
                                  ? [...formData.targetEvents, event.id]
                                  : formData.targetEvents.filter((id: string) => id !== event.id)
                                setFormData({ ...formData, targetEvents: newEvents })
                              }}
                            />
                            <span>{event.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* File Attachments */}
              <div className="space-y-2">
                <Label htmlFor="files" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <Paperclip className="h-4 w-4" />
                  Attach Files <span className="text-muted-foreground font-normal text-xs">(optional)</span>
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
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setCreateOpen(false)
                setFormData(getInitialFormData())
                setSelectedFiles([])
              }}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || uploadingFiles}>
                {(loading || uploadingFiles) && <ButtonLoading />}
                {uploadingFiles ? 'Uploading...' : loading ? 'Creating...' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Event Details Dialog */}
      <Dialog open={eventDetailsOpen} onOpenChange={setEventDetailsOpen}>
        <DialogContent className={`max-w-md max-h-[90vh] overflow-y-auto ${selectedEvent?.important ? `border-2 ${getImportantBorderColor(selectedEvent)}` : ''}`}>
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {selectedEvent.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">When</p>
                  <p className="text-sm">
                    {(() => {
                      const start = new Date(selectedEvent.startUTC)
                      const end = new Date(selectedEvent.endUTC)
                      
                      // Check if it's an all-day event
                      const isAllDay = start.getHours() === 0 && start.getMinutes() === 0 && 
                                       end.getHours() === 23 && end.getMinutes() === 59
                      
                      if (isAllDay) {
                        // If same day, show just one day
                        if (start.toDateString() === end.toDateString()) {
                          return start.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        } else {
                          // Show day-day format with full month and year
                          const startDay = start.getDate()
                          const endDay = end.getDate()
                          const startMonth = start.toLocaleDateString('en-US', { month: 'long' })
                          const endMonth = end.toLocaleDateString('en-US', { month: 'long' })
                          const startYear = start.getFullYear()
                          const endYear = end.getFullYear()
                          
                          // If same month and year
                          if (startMonth === endMonth && startYear === endYear) {
                            return `${startMonth} ${startDay}-${endDay}, ${startYear}`
                          }
                          // If same year but different months
                          else if (startYear === endYear) {
                            return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`
                          }
                          // Different years
                          else {
                            return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`
                          }
                        }
                      }
                      
                      // For regular events, show full date and time
                      return (
                        <>
                          {start.toLocaleString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                          {' - '}
                          {end.toLocaleString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </>
                      )
                    })()}
                  </p>
                </div>

                {selectedEvent.location && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                    <p className="text-sm">{selectedEvent.location}</p>
                  </div>
                )}

                {selectedEvent.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{selectedEvent.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Type</p>
                  <div className="flex items-center gap-2">
                    {getScopeBadge(selectedEvent)}
                    {selectedEvent.testId && (
                      <Badge variant="default" className="text-xs bg-purple-600 hover:bg-purple-700">
                        <FileText className="h-3 w-3 mr-1" />
                        TEST
                      </Badge>
                    )}
                    {selectedEvent.important && (
                      <Badge variant="destructive" className="text-xs">⚠️ IMPORTANT</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Created by</p>
                  <p className="text-sm">{selectedEvent.creator?.user?.name || 'Unknown'}</p>
                </div>

                {/* Attachments Section */}
                {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Attachments</p>
                    <AttachmentDisplay
                      attachments={selectedEvent.attachments}
                      canDelete={canEditEvent(selectedEvent)}
                      onDelete={async (attachmentId) => {
                        try {
                          const response = await fetch(`/api/attachments/upload?id=${attachmentId}`, {
                            method: 'DELETE',
                          })
                          if (response.ok) {
                            // Refresh events and update selected event
                            const eventsResponse = await fetch(`/api/calendar?clubId=${clubId}`)
                            if (eventsResponse.ok) {
                              const data = await eventsResponse.json()
                              setEvents(data.events)
                              const updatedEvent = data.events.find((e: any) => e.id === selectedEvent.id)
                              if (updatedEvent) {
                                setSelectedEvent(updatedEvent)
                              }
                            }
                          }
                        } catch (error) {
                          console.error('Failed to delete attachment:', error)
                        }
                      }}
                    />
                  </div>
                )}

                {/* Jump to Test Button */}
                {selectedEvent.testId && (
                  <div className="border-t pt-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setEventDetailsOpen(false)
                        // Navigate to test start page
                        router.push(`/club/${clubId}/tests/${selectedEvent.testId}/take`)
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Jump to Test
                    </Button>
                  </div>
                )}

                {/* RSVP Section */}
                {selectedEvent.scope !== 'PERSONAL' && selectedEvent.rsvpEnabled && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Your RSVP</p>
                    <div className="flex gap-2 mb-4">
                      {(() => {
                        const userRsvp = getUserRSVP(selectedEvent)
                        return (
                          <>
                            <Button
                              size="sm"
                              variant={userRsvp?.status === 'YES' ? 'default' : 'outline'}
                              onClick={() => handleRSVP(selectedEvent.id, 'YES')}
                              disabled={rsvping}
                              className="flex-1"
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Going
                            </Button>
                            <Button
                              size="sm"
                              variant={userRsvp?.status === 'NO' ? 'default' : 'outline'}
                              onClick={() => handleRSVP(selectedEvent.id, 'NO')}
                              disabled={rsvping}
                              className="flex-1"
                            >
                              <XIcon className="mr-2 h-4 w-4" />
                              Not Going
                            </Button>
                            {userRsvp && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveRSVP(selectedEvent.id)}
                                disabled={rsvping}
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
                      const { yesCount, noCount } = getRSVPCounts(selectedEvent)
                      const yesRsvps = selectedEvent.rsvps?.filter((r: any) => r.status === 'YES') || []
                      const noRsvps = selectedEvent.rsvps?.filter((r: any) => r.status === 'NO') || []
                      
                      return (
                        <div className="space-y-3">
                          {yesCount > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Check className="h-4 w-4 text-green-600" />
                                <p className="text-sm font-medium">Going ({yesCount})</p>
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
                                <p className="text-sm font-medium">Not Going ({noCount})</p>
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
                            <p className="text-sm text-muted-foreground">No RSVPs yet</p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
              {(canEditEvent(selectedEvent) || canDeleteEvent(selectedEvent)) && (
                <DialogFooter className="flex gap-2">
                  {canEditEvent(selectedEvent) && (
                    <Button
                      variant="outline"
                      onClick={() => handleEditClick(selectedEvent)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Event
                    </Button>
                  )}
                  {canDeleteEvent(selectedEvent) && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteClick(selectedEvent.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Event
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Calendar Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description (optional)</Label>
                <textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-isAllDay"
                    checked={formData.isAllDay}
                    onCheckedChange={(checked) => setFormData({ ...formData, isAllDay: checked as boolean })}
                  />
                  <Label htmlFor="edit-isAllDay" className="cursor-pointer font-normal">All day event</Label>
                </div>
                
                {formData.isAllDay ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-startDate">Start Date</Label>
                      <Input
                        id="edit-startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-endDate">End Date</Label>
                      <Input
                        id="edit-endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-date">Date</Label>
                      <Input
                        id="edit-date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-startTime">Start Time</Label>
                      <Input
                        id="edit-startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-endTime">End Time</Label>
                      <Input
                        id="edit-endTime"
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="edit-location">Location (optional)</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-color">Event Color</Label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="color"
                    id="edit-color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-20 rounded cursor-pointer border border-input"
                  />
                  <div className="flex gap-2 flex-wrap">
                    {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded border-2 ${formData.color === color ? 'border-foreground' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-important"
                  checked={formData.important}
                  onCheckedChange={(checked) => setFormData({ ...formData, important: checked as boolean })}
                />
                <Label htmlFor="edit-important" className="cursor-pointer font-normal">
                  Mark as important
                </Label>
              </div>
              <div>
                <Label>Scope</Label>
                <RadioGroup 
                  value={formData.scope} 
                  onValueChange={(value) => setFormData({ ...formData, scope: value as 'PERSONAL' | 'TEAM' | 'CLUB', teamId: '' })}
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="PERSONAL" id="edit-scope-personal" />
                    <Label htmlFor="edit-scope-personal" className="cursor-pointer font-normal text-sm">
                      Personal event
                    </Label>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="TEAM" id="edit-scope-team" />
                        <Label htmlFor="edit-scope-team" className="cursor-pointer font-normal text-sm">
                          Entire club
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="TEAM" id="edit-scope-team" />
                        <Label htmlFor="edit-scope-team" className="cursor-pointer font-normal text-sm">
                          Specific team
                        </Label>
                      </div>
                    </>
                  )}
                </RadioGroup>
                {formData.scope === 'TEAM' && (
                  <div className="mt-3">
                    <Label htmlFor="edit-team">Select Team</Label>
                    <select
                      id="edit-team"
                      value={formData.teamId}
                      onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select a team...</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(formData.scope === 'CLUB' || formData.scope === 'TEAM') && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="edit-rsvp-enabled"
                        checked={formData.rsvpEnabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, rsvpEnabled: checked as boolean })}
                      />
                      <Label htmlFor="edit-rsvp-enabled" className="cursor-pointer font-normal text-sm">
                        Enable RSVP for this event
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setEditOpen(false)
                setSelectedEvent(null)
                setFormData(getInitialFormData())
              }}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <ButtonLoading />}
                {loading ? 'Updating...' : 'Update Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
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

      {/* Event Announcement Modal */}
      {createdEvent && (
        <EventAnnouncementModal
          open={showAnnouncementModal}
          onOpenChange={setShowAnnouncementModal}
          onConfirm={handleAnnouncementConfirm}
          eventTitle={createdEvent.title}
          eventScope={createdEvent.scope}
          teamName={createdEvent.team?.name}
        />
      )}
    </div>
  )
}
