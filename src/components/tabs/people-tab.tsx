'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { ButtonLoading, PageLoading } from '@/components/ui/loading-spinner'
import { Plus, Pencil, Trash2, ArrowLeft, X, FileSpreadsheet, Mail, Grid3x3, Layers } from 'lucide-react'
import { groupEventsByCategory, categoryOrder, type EventCategory } from '@/lib/event-categories'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClubWithMembers, ClubWithMembersLite, MembershipWithPreferences } from '@/types/models'

// ---------------------------------------------------------------------------
// Derived sub-types from ClubWithMembers
// ---------------------------------------------------------------------------
type ClubMembership = ClubWithMembers['memberships'][number]
type ClubTeam = ClubWithMembers['teams'][number]
type BaseRosterAssignment = ClubMembership['rosterAssignments'][number]
type ClubInput = ClubWithMembers | ClubWithMembersLite
type RosterAssignmentWithMembership = BaseRosterAssignment & {
  membership: ClubMembership
}

interface SciOlyEvent {
  id: string
  name: string
  slug: string
  maxCompetitors: number
  selfScheduled?: boolean
}

interface ConflictGroup {
  id: string
  events: { eventId: string }[]
}

interface PeopleTabProps {
  club: ClubInput
  currentMembership: MembershipWithPreferences
  isAdmin: boolean
}

function hasFullPeopleData(club: ClubInput): club is ClubWithMembers {
  const hasRosterAssignments = club.memberships.every((membership) =>
    Array.isArray((membership as ClubMembership).rosterAssignments),
  )
  const hasTeamMembers = club.teams.every((team) =>
    Array.isArray((team as ClubTeam).members),
  )
  return hasRosterAssignments && hasTeamMembers
}

function normalizePeopleClub(club: ClubInput): ClubWithMembers {
  return {
    ...club,
    memberships: club.memberships.map((membership) => ({
      ...(membership as ClubMembership),
      team: (membership as ClubMembership).team ?? null,
      rosterAssignments: Array.isArray((membership as ClubMembership).rosterAssignments)
        ? (membership as ClubMembership).rosterAssignments
        : [],
      preferences: (membership as ClubMembership).preferences ?? null,
    })),
    teams: club.teams.map((team) => ({
      ...(team as ClubTeam),
      members: Array.isArray((team as ClubTeam).members) ? (team as ClubTeam).members : [],
      _count: (team as ClubTeam)._count ?? { rosterAssignments: 0 },
    })),
  } as ClubWithMembers
}

export function PeopleTab({ club: initialClubInput, currentMembership: _currentMembership, isAdmin }: PeopleTabProps) {
  const { toast } = useToast()
  
  // Local club state for immediate updates
  const [club, setClub] = useState<ClubWithMembers>(() => normalizePeopleClub(initialClubInput))
  const [loadingClubData, setLoadingClubData] = useState(!hasFullPeopleData(initialClubInput))
  
  // Team management state
  const [selectedTeam, setSelectedTeam] = useState<ClubTeam | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [editingTeam, setEditingTeam] = useState<ClubTeam | null>(null)
  const [editTeamName, setEditTeamName] = useState('')
  
  // Roster state
  const [events, setEvents] = useState<SciOlyEvent[]>([])
  const [conflictGroups, setConflictGroups] = useState<ConflictGroup[]>([])
  const [assignments, setAssignments] = useState<RosterAssignmentWithMembership[]>([])
  const [rosterViewMode, setRosterViewMode] = useState<'category' | 'conflict'>('category')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teamToDelete, setClubToDelete] = useState<ClubTeam | null>(null)
  const [memberSortBy, setMemberSortBy] = useState<'alphabetical' | 'events' | 'team' | 'role'>('alphabetical')
  const [memberSortDirection, setMemberSortDirection] = useState<'low-to-high' | 'high-to-low'>('low-to-high')
  const [addMemberSelectValues, setAddMemberSelectValues] = useState<Record<string, string>>({})
  const [selectResetKeys, setSelectResetKeys] = useState<Record<string, number>>({})

  useEffect(() => {
    if (hasFullPeopleData(initialClubInput)) {
      setClub(normalizePeopleClub(initialClubInput))
      setLoadingClubData(false)
      return
    }

    let isMounted = true
    const fetchFullClubData = async () => {
      setLoadingClubData(true)
      try {
        const response = await fetch(`/api/clubs/${initialClubInput.id}`)
        if (!response.ok) {
          throw new Error('Failed to load full club data')
        }

        const data = (await response.json()) as { club?: ClubWithMembers }
        if (!isMounted || !data.club) return
        setClub(normalizePeopleClub(data.club))
      } catch (error) {
        console.error('Failed to fetch full people tab club data:', error)
        toast({
          title: 'Error',
          description: 'Failed to load full roster data',
          variant: 'destructive',
        })
      } finally {
        if (isMounted) {
          setLoadingClubData(false)
        }
      }
    }

    fetchFullClubData()
    return () => {
      isMounted = false
    }
  }, [initialClubInput, toast])

  useEffect(() => {
    fetchEvents()
    fetchConflictGroups()
  }, [club.id])

  // Update assignments whenever team memberships change
  useEffect(() => {
    fetchAssignments()
  }, [club.memberships])

  if (loadingClubData) {
    return (
      <PageLoading
        title="Loading people"
        description="Fetching members and roster assignments..."
        variant="orbit"
      />
    )
  }

  const fetchEvents = async () => {
    try {
      const response = await fetch(`/api/events?division=${club.division}`)
      if (response.ok) {
        const data = await response.json() as { events: SciOlyEvent[] }
        setEvents(data.events)
      }
    } catch (error: unknown) {
      console.error('Failed to fetch events:', error)
    }
  }

  const fetchConflictGroups = async () => {
    try {
      const response = await fetch(`/api/conflicts?division=${club.division}`)
      if (response.ok) {
        const data = await response.json() as { conflictGroups?: ConflictGroup[] }
        setConflictGroups(data.conflictGroups || [])
      }
    } catch (error: unknown) {
      console.error('Failed to fetch conflict groups:', error)
    }
  }

  const fetchAssignments = () => {
    const allAssignments: RosterAssignmentWithMembership[] = []
    club.memberships.forEach((m) => {
      m.rosterAssignments.forEach((a) => {
        allAssignments.push({
          ...a,
          membership: m,
        })
      })
    })
    setAssignments(allAssignments)
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/clubs/${club.id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName }),
      })

      if (!response.ok) throw new Error('Failed to create team')

      const data = await response.json() as { team: { id: string; name: string; teamId: string; createdAt: string; updatedAt: string } }
      const newTeam = data.team

      // Update local state immediately
      setClub((prev) => ({
        ...prev,
        teams: [
          ...prev.teams,
          {
            id: newTeam.id,
            name: newTeam.name,
            teamId: newTeam.teamId,
            createdAt: newTeam.createdAt,
            updatedAt: newTeam.updatedAt,
            members: [],
            _count: { rosterAssignments: 0 },
          } as unknown as ClubTeam,
        ],
      }))

      toast({
        title: 'Team created',
        description: newTeamName,
      })

      setNewTeamName('')
      setCreateOpen(false)
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to create team',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }


  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTeam) return

    setLoading(true)

    try {
      const response = await fetch(`/api/clubs/${club.id}/teams/${editingTeam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editTeamName }),
      })

      if (!response.ok) throw new Error('Failed to update team')

      // Update local state immediately
      setClub((prev) => ({
        ...prev,
        teams: prev.teams.map((s) =>
          s.id === editingTeam.id ? { ...s, name: editTeamName } : s
        ),
      }))

      // Update selectedTeam if it's the one being edited
      if (selectedTeam && selectedTeam.id === editingTeam.id) {
        setSelectedTeam((prev) => (prev ? { ...prev, name: editTeamName } : null))
      }

      toast({
        title: 'Team updated',
        description: editTeamName,
      })

      setEditOpen(false)
      setEditingTeam(null)
      setEditTeamName('')
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to update team',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const openDeleteDialog = (team: ClubTeam) => {
    setClubToDelete(team)
    setDeleteDialogOpen(true)
  }

  const handleDeleteTeam = async () => {
    if (!teamToDelete) return

    setLoading(true)

    try {
      const response = await fetch(`/api/clubs/${club.id}/teams/${teamToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete team')
      }

      // Update local state immediately
      setClub((prev) => ({
        ...prev,
        teams: prev.teams.filter((s) => s.id !== teamToDelete.id),
        memberships: prev.memberships.map((m) =>
          m.teamId === teamToDelete.id ? { ...m, teamId: null } : m
        ),
      }))

      // If current selected team was deleted, go back to grid view
      if (selectedTeam && selectedTeam.id === teamToDelete.id) {
        setSelectedTeam(null)
      }

      toast({
        title: 'Team deleted',
        description: `${teamToDelete.name} has been deleted`,
      })

      setClubToDelete(null)
      setDeleteDialogOpen(false)
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete team',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const openEditDialog = (team: ClubTeam) => {
    setEditingTeam(team)
    setEditTeamName(team.name)
    setEditOpen(true)
  }

  const handleAddMemberToEvent = async (eventId: string, membershipId: string) => {
    if (!selectedTeam) return

    setLoading(true)
    try {
      const response = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          membershipId: membershipId,
          eventId: eventId,
        }),
      })

      const data = await response.json() as { error?: string; assignment: RosterAssignmentWithMembership }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign member')
      }

      const newAssignment = data.assignment

      // Update local assignments state immediately
      setAssignments((prev) => [...prev, newAssignment])

      // Update local team state to include the new roster assignment
      setClub((prev) => ({
        ...prev,
        memberships: prev.memberships.map((m) =>
          m.id === membershipId
            ? {
                ...m,
                rosterAssignments: [...(m.rosterAssignments || []), newAssignment],
              }
            : m
        ),
      }))

      // Reset the select dropdown to "Add member..." by removing the key and incrementing reset counter
      const selectKey = `${eventId}-${selectedTeam.id}`
      setAddMemberSelectValues((prev) => {
        const newValues = { ...prev }
        delete newValues[selectKey]
        return newValues
      })
      // Force re-render by incrementing the key
      setSelectResetKeys((prev) => ({
        ...prev,
        [selectKey]: (prev[selectKey] || 0) + 1,
      }))

      const event = events.find(e => e.id === eventId)
      toast({
        title: 'Member assigned',
        description: event ? `Added to ${event.name}` : 'Added to event',
      })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign member',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMemberFromEvent = async (assignmentId: string) => {
    setLoading(true)
    try {
      // Find the assignment before deleting to update local state
      const assignmentToRemove = assignments.find((a) => a.id === assignmentId)
      
      const response = await fetch(`/api/roster/${assignmentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to remove member')

      // Update local assignments state immediately
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))

      // Update local team state to remove the roster assignment
      if (assignmentToRemove) {
        setClub((prev) => ({
          ...prev,
          memberships: prev.memberships.map((m) =>
            m.id === assignmentToRemove.membershipId
              ? {
                  ...m,
                  rosterAssignments: (m.rosterAssignments || []).filter(
                    (a) => a.id !== assignmentId
                  ),
                }
              : m
          ),
        }))
      }

      toast({
        title: 'Member removed',
      })
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }


  const getAssignmentsForEvent = (eventId: string, teamId: string) => {
    return assignments.filter((a) => a.eventId === eventId && a.teamId === teamId)
  }

  const _getAvailableEventsForMember = (member: ClubMembership) => {
    if (!selectedTeam) return []
    
    const memberAssignments = assignments.filter((a) => a.membership.id === member.id && a.teamId === selectedTeam.id)
    const assignedEventIds = memberAssignments.map((a) => a.eventId)
    
    // Filter available events
    return events.filter((event) => {
      // Already assigned
      if (assignedEventIds.includes(event.id)) return false
      
      // Check capacity
      const eventAssignments = getAssignmentsForEvent(event.id, selectedTeam.id)
      if (eventAssignments.length >= event.maxCompetitors) return false
      
      return true
    })
  }

  const getAvailableMembersForEvent = (eventId: string, teamId: string) => {
    if (!selectedTeam) return []
    
    const teamMembers = club.memberships.filter((m) => m.teamId === teamId)
    const eventAssignments = getAssignmentsForEvent(eventId, teamId)
    const assignedMemberIds = eventAssignments.map((a) => a.membership.id)
    
    return teamMembers.filter((member) => !assignedMemberIds.includes(member.id))
  }

  const handleAssignToTeamFromMenu = async (membershipId: string, teamId: string | null, memberName: string) => {
    // Check if target team is at capacity (15 members)
    if (teamId) {
      const targetTeam = club.teams.find((s) => s.id === teamId)
      if (targetTeam && targetTeam.members.length >= 15) {
        toast({
          title: 'Team at capacity',
          description: `${targetTeam.name} already has 15 members`,
          variant: 'destructive',
        })
        return
      }
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
      })

      if (!response.ok) throw new Error('Failed to assign member')

      const teamName = teamId 
        ? club.teams.find((s) => s.id === teamId)?.name 
        : 'Unassigned'

      // Update local state immediately
      setClub((prev) => {
        const member = prev.memberships.find((m) => m.id === membershipId)
        const updatedMember = { ...member, teamId } as ClubMembership
        
        return {
          ...prev,
          memberships: prev.memberships.map((m) => 
            m.id === membershipId ? updatedMember : m
          ),
          teams: prev.teams.map((s) => ({
            ...s,
            members: s.id === teamId
              // Add member to new team (if assigning to a team)
              ? [...s.members.filter((m) => m.id !== membershipId), updatedMember]
              // Remove member from other teams
              : s.members.filter((m) => m.id !== membershipId)
          }))
        }
      })

      toast({
        title: 'Member assigned',
        description: `${memberName} moved to ${teamName}`,
      })
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to assign member',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const _handleAssignToEventFromMenu = async (membershipId: string, eventId: string, memberName: string, eventName: string) => {
    if (!selectedTeam) return

    setLoading(true)

    try {
      const response = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          membershipId,
          eventId,
        }),
      })

      const data = await response.json() as { error?: string; assignment: RosterAssignmentWithMembership }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign member')
      }

      const newAssignment = data.assignment

      // Update local assignments state immediately
      setAssignments((prev) => [...prev, newAssignment])

      // Update local team state to include the new roster assignment
      setClub((prev) => ({
        ...prev,
        memberships: prev.memberships.map((m) =>
          m.id === membershipId
            ? {
                ...m,
                rosterAssignments: [...(m.rosterAssignments || []), newAssignment],
              }
            : m
        ),
      }))

      toast({
        title: 'Member assigned',
        description: `${memberName} added to ${eventName}`,
      })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign member',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRole = async (membershipId: string, role: 'COACH' | 'CAPTAIN' | 'MEMBER' | 'UNASSIGNED') => {
    setLoading(true)

    // UNASSIGNED = empty roles array
    // MEMBER = ['MEMBER'] 
    // CAPTAIN = ['CAPTAIN']
    // COACH = ['COACH']
    const newRoles = role === 'UNASSIGNED' ? [] : [role]

    try {
      const response = await fetch(`/api/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: newRoles }),
      })

      if (!response.ok) throw new Error('Failed to update role')

      // Update local state immediately
      setClub((prev) => ({
        ...prev,
        memberships: prev.memberships.map((m) => 
          m.id === membershipId ? { ...m, roles: newRoles } : m
        ),
        teams: prev.teams.map((s) => ({
          ...s,
          members: s.members.map((m) => 
            m.id === membershipId ? { ...m, roles: newRoles } : m
          )
        }))
      }))

      toast({
        title: 'Role updated',
        description: role === 'UNASSIGNED' ? 'Role unassigned' : role === 'MEMBER' ? 'Set to member role' : `Assigned ${role.toLowerCase()} role`,
      })
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportToGoogleSheet = () => {
    // Generate CSV data for rosters
    let csvContent = "data:text/csv;charset=utf-8,"
    
    // Add header
    csvContent += `${club.name} - Event Rosters\n\n`
    
    // For each team
    club.teams.forEach((team) => {
      csvContent += `\nTeam: ${team.name}\n`
      csvContent += "Event,Member 1,Member 2,Member 3\n"
      
      // Get events and assignments for this team
      events.forEach((event) => {
        const eventAssignments = assignments.filter(
          (a) => a.eventId === event.id && a.teamId === team.id
        )
        
        if (eventAssignments.length > 0) {
          const memberNames = eventAssignments.map(
            (a) => a.membership.user.name || a.membership.user.email
          )
          csvContent += `"${event.name}",${memberNames.join(',')}\n`
        }
      })
    })
    
    // Create download link
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${club.name}-rosters.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({
      title: 'Rosters exported',
      description: 'CSV file downloaded. You can import this into Google Sheets.',
    })
  }

  const _teamMembers = selectedTeam ? club.memberships.filter((m) => m.teamId === selectedTeam.id) : []
  const _unassignedMembers = club.memberships.filter((m) => !m.teamId)

  // Get event counts for all members
  const getAllMemberEventCounts = () => {
    const counts: Record<string, number> = {}
    club.memberships.forEach((member) => {
      counts[member.id] = member.rosterAssignments?.length || 0
    })
    return counts
  }

  // Sort all members
  const getSortedMembers = () => {
    const eventCounts = getAllMemberEventCounts()
    const sorted = [...club.memberships]
    const isReversed = memberSortDirection === 'high-to-low'

    switch (memberSortBy) {
      case 'alphabetical':
        sorted.sort((a, b) => {
          const nameA = (a.user.name || a.user.email).toLowerCase()
          const nameB = (b.user.name || b.user.email).toLowerCase()
          const result = nameA.localeCompare(nameB)
          return isReversed ? -result : result
        })
        break
      case 'events':
        sorted.sort((a, b) => {
          const result = (eventCounts[a.id] || 0) - (eventCounts[b.id] || 0)
          return isReversed ? -result : result
        })
        break
      case 'team':
        // Sort by team creation order (using team array index as proxy for creation order)
        sorted.sort((a, b) => {
          const getTeamOrder = (member: ClubMembership) => {
            if (!member.teamId) return club.teams.length // Unassigned goes last
            return club.teams.findIndex((st) => st.id === member.teamId)
          }
          const result = getTeamOrder(a) - getTeamOrder(b)
          return isReversed ? -result : result
        })
        break
      case 'role':
        sorted.sort((a, b) => {
          const getRoleOrder = (role: string) => {
            const upperRole = role?.toUpperCase()
            if (upperRole === 'ADMIN') return 0
            if (upperRole === 'MEMBER') return 1
            return 2
          }
          const result = getRoleOrder(a.role) - getRoleOrder(b.role)
          return isReversed ? -result : result
        })
        break
    }

    return sorted
  }

  const handleEmailAll = () => {
    const allMembers = club.memberships
    const admins = allMembers.filter((m) => String(m.role).toUpperCase() === 'ADMIN')
    const regularMembers = allMembers.filter((m) => String(m.role).toUpperCase() !== 'ADMIN')
    
    const bccEmails = regularMembers.map((m) => m.user.email).join(',')
    const ccEmails = admins.map((m) => m.user.email).join(',')
    
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(bccEmails)}&cc=${encodeURIComponent(ccEmails)}&subject=${encodeURIComponent(`${club.name} Team Communication`)}`
    window.location.href = mailtoLink
  }

  // Render Team Grid View
  const renderGridView = () => (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            {isAdmin && (
              <Button onClick={() => setCreateOpen(true)} size="sm" className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Create Team
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" onClick={handleEmailAll} size="sm" className="w-full sm:w-auto">
                <Mail className="mr-2 h-4 w-4" />
                Email All
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={handleExportToGoogleSheet} size="sm" className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
        </div>

        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {club.teams.map((team) => (
            <Card 
              key={team.id}
              className="cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('button')) {
                  setSelectedTeam(team)
                }
              }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <span className="break-words">{team.name}</span>
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground whitespace-nowrap">
                    ({team.members.length} / 15)
                  </span>
                </CardTitle>
              </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2.5">
                    {team.members.slice(0, 5).map((member) => (
                      <div key={member.id} className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9 sm:h-8 sm:w-8 flex-shrink-0">
                          <AvatarImage src={member.user.image || ''} />
                          <AvatarFallback className="text-xs">
                            {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-sm min-w-0">
                          <p className="font-medium truncate text-sm">{member.user.name || member.user.email}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {String(member.role).toUpperCase() === 'ADMIN' && (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase px-1.5 py-0">Admin</Badge>
                            )}
                            {Array.isArray(member.roles) && member.roles.includes('COACH') && (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase px-1.5 py-0">Coach</Badge>
                            )}
                            {Array.isArray(member.roles) && member.roles.includes('CAPTAIN') && (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase px-1.5 py-0">Captain</Badge>
                            )}
                            {(!Array.isArray(member.roles) || member.roles.length === 0) && String(member.role).toUpperCase() === 'ADMIN' && (
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase px-1.5 py-0">Member</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {team.members.length > 5 && (
                      <p className="text-xs sm:text-sm text-muted-foreground pl-11 sm:pl-10">
                        +{team.members.length - 5} more
                      </p>
                    )}
                    {team.members.length === 0 && (
                      <p className="text-xs sm:text-sm text-muted-foreground text-center py-2">No members assigned</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col gap-2">
                <CardTitle className="text-xl sm:text-2xl">All Club Members</CardTitle>
                {isAdmin && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Use the actions menu to manage teams and roles
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Sort by:</Label>
                  <Select value={memberSortBy} onValueChange={(value) => setMemberSortBy(value as typeof memberSortBy)}>
                    <SelectTrigger className="text-xs sm:text-sm flex-1 sm:flex-none h-9 w-full sm:w-auto">
                      <SelectValue placeholder="Alphabetical" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alphabetical">Alphabetical</SelectItem>
                      <SelectItem value="role">Role</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="events">Number of Events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center">
                  <Select value={memberSortDirection} onValueChange={(value) => setMemberSortDirection(value as typeof memberSortDirection)}>
                    <SelectTrigger className="text-xs sm:text-sm h-9 w-full sm:w-auto">
                      <SelectValue placeholder="Low to High" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low-to-high">Low to High</SelectItem>
                      <SelectItem value="high-to-low">High to Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-2">
              {getSortedMembers().map((member) => {
                const eventCount = member.rosterAssignments?.length || 0
                const memberRoles: string[] = Array.isArray(member.roles) ? member.roles : []
  return (
                  <div key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-lg border p-4 sm:p-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-12 w-12 sm:h-10 sm:w-10 flex-shrink-0">
            <AvatarImage src={member.user.image || ''} />
            <AvatarFallback className="text-sm sm:text-base">
              {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-base sm:text-sm break-words">{member.user.name || member.user.email}</p>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
              {String(member.role).toUpperCase() === 'ADMIN' && (
                            <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase px-1.5 py-0.5">Admin</Badge>
              )}
              {memberRoles.includes('COACH') && (
                <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase px-1.5 py-0.5">Coach</Badge>
              )}
              {memberRoles.includes('CAPTAIN') && (
                <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase px-1.5 py-0.5">Captain</Badge>
              )}
              {memberRoles.includes('MEMBER') && (
                <Badge variant="outline" className="text-[9px] sm:text-[10px] uppercase px-1.5 py-0.5">Member</Badge>
              )}
              <span className="whitespace-nowrap">{(memberRoles.length > 0 || String(member.role).toUpperCase() === 'ADMIN') ? '• ' : ''}{eventCount} event{eventCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 sm:flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              window.location.href = `mailto:${member.user.email}`
            }}
            className="w-full sm:w-auto justify-start sm:justify-center h-9"
          >
            <Mail className="h-4 w-4 sm:mr-0 mr-2" />
            <span className="sm:hidden">Email</span>
          </Button>
          {isAdmin && (
                        <>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Label htmlFor={`role-${member.id}`} className="text-xs text-muted-foreground whitespace-nowrap">Role:</Label>
                            <Select
                              value={
                                memberRoles.includes('COACH') ? 'COACH' :
                                memberRoles.includes('CAPTAIN') ? 'CAPTAIN' :
                                memberRoles.includes('MEMBER') ? 'MEMBER' :
                                'UNASSIGNED'
                              }
                              onValueChange={(value) => handleUpdateRole(member.id, value as 'COACH' | 'CAPTAIN' | 'MEMBER' | 'UNASSIGNED')}
                            >
                              <SelectTrigger id={`role-${member.id}`} className="text-xs sm:text-sm h-9 flex-1 sm:flex-none sm:w-auto" onClick={(e) => e.stopPropagation()}>
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent onClick={(e) => e.stopPropagation()}>
                                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                                <SelectItem value="MEMBER">Member</SelectItem>
                                <SelectItem value="CAPTAIN">Captain</SelectItem>
                                <SelectItem value="COACH">Coach</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Label htmlFor={`team-${member.id}`} className="text-xs text-muted-foreground whitespace-nowrap">Team:</Label>
                            <Select
                              value={member.teamId || 'UNASSIGNED'}
                              onValueChange={(value) => handleAssignToTeamFromMenu(member.id, value === 'UNASSIGNED' ? null : value, member.user.name || member.user.email)}
                            >
                              <SelectTrigger id={`team-${member.id}`} className="text-xs sm:text-sm h-9 flex-1 sm:flex-none sm:w-auto" onClick={(e) => e.stopPropagation()}>
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent onClick={(e) => e.stopPropagation()}>
                                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                                {club.teams.map((team) => (
                                  <SelectItem 
                                    key={team.id} 
                                    value={team.id}
                                    disabled={team.id !== member.teamId && team.members.length >= 15}
                                  >
                                    {team.name} ({team.members.length}/15)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    )

  // Render Team Detail View (roster) - adapted from roster-tab
  const renderTeamView = () => {
    if (!selectedTeam) return null

    const teamMembers = club.memberships.filter((m) => m.teamId === selectedTeam.id)

    const handleEmailTeam = () => {
      const teamMembersForEmail = teamMembers
      const allAdmins = club.memberships.filter((m) => String(m.role).toUpperCase() === 'ADMIN')
      
      const bccEmails = teamMembersForEmail.map((m) => m.user.email).join(',')
      const ccEmails = allAdmins.map((m) => m.user.email).join(',')
      
      const mailtoLink = `mailto:?bcc=${encodeURIComponent(bccEmails)}&cc=${encodeURIComponent(ccEmails)}&subject=${encodeURIComponent(`${selectedTeam.name} Team Communication`)}`
      window.location.href = mailtoLink
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setSelectedTeam(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to People
              </Button>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedTeam)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Team
              </Button>
              <Button variant="outline" size="sm" onClick={() => openDeleteDialog(selectedTeam)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Team
              </Button>
            </div>
          )}
        </div>

        {/* Team Members Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Team Members</CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant="outline">
                  {teamMembers.length} / 15 members
                </Badge>
                <Button variant="outline" size="sm" onClick={handleEmailTeam}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email Team
                </Button>
      </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamMembers.map((member) => {
                const memberEventAssignments = assignments.filter(
                  (a) => a.membership.id === member.id && a.teamId === selectedTeam.id
                )
                return (
                  <div key={member.id} className="flex items-start justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.user.image || ''} />
                        <AvatarFallback>
                          {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{member.user.name || member.user.email}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {memberEventAssignments.length > 0 ? (
                            memberEventAssignments.map((assignment) => {
                              const event = events.find((e) => e.id === assignment.eventId)
                              return event ? (
                                <Badge key={assignment.id} variant="secondary" className="text-[10px]">
                                  {event.name}
                                </Badge>
                              ) : null
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground">No events assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {teamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No members in this team yet. Assign members using the dropdown in the &quot;All Club Members&quot; section below.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  Event Roster - Division {club.division}
                </CardTitle>
                {isAdmin && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a member from dropdown to assign to events
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={rosterViewMode === 'category' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRosterViewMode('category')}
                >
                  <Grid3x3 className="mr-2 h-4 w-4" />
                  By Category
                </Button>
                <Button
                  variant={rosterViewMode === 'conflict' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRosterViewMode('conflict')}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  By Conflicts
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rosterViewMode === 'category' ? (
              // Group by Category
              <div className="space-y-6">
                {Object.entries(groupEventsByCategory(events, club.division))
                  .sort(([a], [b]) => 
                    categoryOrder.indexOf(a as EventCategory) - categoryOrder.indexOf(b as EventCategory)
                  )
                  .map(([category, categoryEvents]) => (
                    <div key={category}>
                      <h3 className="mb-3 text-lg font-semibold">{category}</h3>
                      <div className="space-y-3">
                        {(categoryEvents as SciOlyEvent[]).map((event) => {
                          const eventAssignments = getAssignmentsForEvent(event.id, selectedTeam.id)
                          const atCapacity = eventAssignments.length >= event.maxCompetitors

                          return (
                            <div
                              key={event.id}
                              className="flex items-start justify-between rounded-lg border p-4"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{event.name}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {eventAssignments.length}/{event.maxCompetitors}
                                  </Badge>
                                  {event.selfScheduled && (
                                    <Badge variant="secondary" className="text-xs">
                                      Self-Scheduled
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {eventAssignments.map((assignment) => (
                                    <div
                                      key={assignment.id}
                                      className="flex items-center gap-2 rounded-full bg-muted px-3 py-1"
                                    >
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={assignment.membership.user.image || ''} />
                                        <AvatarFallback className="text-xs">
                                          {assignment.membership.user.name?.charAt(0) || 'U'}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-sm">
                                        {assignment.membership.user.name || assignment.membership.user.email}
                                      </span>
                                      {isAdmin && (
                                        <button
                                          onClick={() => handleRemoveMemberFromEvent(assignment.id)}
                                          className="ml-1 text-muted-foreground hover:text-destructive"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {isAdmin && !atCapacity && (() => {
                                const availableMembers = getAvailableMembersForEvent(event.id, selectedTeam.id)
                                return availableMembers.length > 0 ? (
                                  <Select
                                    key={`${event.id}-${selectedTeam.id}-${selectResetKeys[`${event.id}-${selectedTeam.id}`] || 0}`}
                                    value={addMemberSelectValues[`${event.id}-${selectedTeam.id}`] || undefined}
                                    onValueChange={(value) => {
                                      if (value) {
                                        handleAddMemberToEvent(event.id, value)
                                      }
                                    }}
                                    onOpenChange={(open) => {
                                      // Reset when dropdown closes if no value was selected
                                      if (!open && !addMemberSelectValues[`${event.id}-${selectedTeam.id}`]) {
                                        const selectKey = `${event.id}-${selectedTeam.id}`
                                        setAddMemberSelectValues((prev) => {
                                          const newValues = { ...prev }
                                          delete newValues[selectKey]
                                          return newValues
                                        })
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="text-sm h-9">
                                      <SelectValue placeholder="Add member..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableMembers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                          {member.user.name || member.user.email}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="text-xs text-muted-foreground px-3 py-2 text-center whitespace-nowrap">
                                    No available members
                                  </div>
                                )
                              })()}
                              {atCapacity && (
                                <Badge variant="secondary" className="mt-1">
                                  Full
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              // Group by Conflict Blocks
              <div className="space-y-6">
                {conflictGroups.map((group, index: number) => {
                  const groupEvents = events.filter((e) => 
                    group.events.some((ge) => ge.eventId === e.id)
                  )
                  return (
                    <div key={group.id}>
                      <h3 className="mb-3 text-lg font-semibold">Conflict Block {index + 1}</h3>
                      <div className="space-y-3">
                        {groupEvents.map((event) => {
                          const eventAssignments = getAssignmentsForEvent(event.id, selectedTeam.id)
                          const atCapacity = eventAssignments.length >= event.maxCompetitors

                          return (
                            <div
                              key={event.id}
                              className="flex items-start justify-between rounded-lg border p-4"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{event.name}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {eventAssignments.length}/{event.maxCompetitors}
                                  </Badge>
                                  {event.selfScheduled && (
                                    <Badge variant="secondary" className="text-xs">
                                      Self-Scheduled
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {eventAssignments.map((assignment) => (
                                    <div
                                      key={assignment.id}
                                      className="flex items-center gap-2 rounded-full bg-muted px-3 py-1"
                                    >
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={assignment.membership.user.image || ''} />
                                        <AvatarFallback className="text-xs">
                                          {assignment.membership.user.name?.charAt(0) || 'U'}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-sm">
                                        {assignment.membership.user.name || assignment.membership.user.email}
                                      </span>
                                      {isAdmin && (
                                        <button
                                          onClick={() => handleRemoveMemberFromEvent(assignment.id)}
                                          className="ml-1 text-muted-foreground hover:text-destructive"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {isAdmin && !atCapacity && (() => {
                                const availableMembers = getAvailableMembersForEvent(event.id, selectedTeam.id)
                                return availableMembers.length > 0 ? (
                                  <Select
                                    key={`${event.id}-${selectedTeam.id}-${selectResetKeys[`${event.id}-${selectedTeam.id}`] || 0}`}
                                    value={addMemberSelectValues[`${event.id}-${selectedTeam.id}`] || undefined}
                                    onValueChange={(value) => {
                                      if (value) {
                                        handleAddMemberToEvent(event.id, value)
                                      }
                                    }}
                                    onOpenChange={(open) => {
                                      // Reset when dropdown closes if no value was selected
                                      if (!open && !addMemberSelectValues[`${event.id}-${selectedTeam.id}`]) {
                                        const selectKey = `${event.id}-${selectedTeam.id}`
                                        setAddMemberSelectValues((prev) => {
                                          const newValues = { ...prev }
                                          delete newValues[selectKey]
                                          return newValues
                                        })
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="text-sm h-9">
                                      <SelectValue placeholder="Add member..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableMembers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                          {member.user.name || member.user.email}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="text-xs text-muted-foreground px-3 py-2 text-center whitespace-nowrap">
                                    No available members
                                  </div>
                                )
                              })()}
                              {atCapacity && (
                                <Badge variant="secondary" className="mt-1">
                                  Full
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {/* Show ungrouped events */}
                {(() => {
                  const groupedEventIds = new Set(
                    conflictGroups.flatMap((g) => g.events.map((e) => e.eventId))
                  )
                  const ungroupedEvents = events.filter((e) => !groupedEventIds.has(e.id))
                  
                  return ungroupedEvents.length > 0 ? (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold">Other Events</h3>
                      <div className="space-y-3">
                        {ungroupedEvents.map((event) => {
                          const eventAssignments = getAssignmentsForEvent(event.id, selectedTeam.id)
                          const atCapacity = eventAssignments.length >= event.maxCompetitors

                          return (
                            <div
                              key={event.id}
                              className="flex items-start justify-between rounded-lg border p-4"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{event.name}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {eventAssignments.length}/{event.maxCompetitors}
                                  </Badge>
                                  {event.selfScheduled && (
                                    <Badge variant="secondary" className="text-xs">
                                      Self-Scheduled
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {eventAssignments.map((assignment) => (
                                    <div
                                      key={assignment.id}
                                      className="flex items-center gap-2 rounded-full bg-muted px-3 py-1"
                                    >
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={assignment.membership.user.image || ''} />
                                        <AvatarFallback className="text-xs">
                                          {assignment.membership.user.name?.charAt(0) || 'U'}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-sm">
                                        {assignment.membership.user.name || assignment.membership.user.email}
                                      </span>
                                      {isAdmin && (
                                        <button
                                          onClick={() => handleRemoveMemberFromEvent(assignment.id)}
                                          className="ml-1 text-muted-foreground hover:text-destructive"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {isAdmin && !atCapacity && (() => {
                                const availableMembers = getAvailableMembersForEvent(event.id, selectedTeam.id)
                                return availableMembers.length > 0 ? (
                                  <Select
                                    key={`${event.id}-${selectedTeam.id}-${selectResetKeys[`${event.id}-${selectedTeam.id}`] || 0}`}
                                    value={addMemberSelectValues[`${event.id}-${selectedTeam.id}`] || undefined}
                                    onValueChange={(value) => {
                                      if (value) {
                                        handleAddMemberToEvent(event.id, value)
                                      }
                                    }}
                                    onOpenChange={(open) => {
                                      // Reset when dropdown closes if no value was selected
                                      if (!open && !addMemberSelectValues[`${event.id}-${selectedTeam.id}`]) {
                                        const selectKey = `${event.id}-${selectedTeam.id}`
                                        setAddMemberSelectValues((prev) => {
                                          const newValues = { ...prev }
                                          delete newValues[selectKey]
                                          return newValues
                                        })
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="text-sm h-9">
                                      <SelectValue placeholder="Add member..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableMembers.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                          {member.user.name || member.user.email}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="text-xs text-muted-foreground px-3 py-2 text-center whitespace-nowrap">
                                    No available members
                                  </div>
                                )
                              })()}
                              {atCapacity && (
                                <Badge variant="secondary" className="mt-1">
                                  Full
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      {selectedTeam ? renderTeamView() : renderGridView()}

      {/* Create Team Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Create a new team for roster management
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Team A, Varsity, JV"
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <ButtonLoading />}
                {loading ? 'Creating...' : 'Create Team'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update team name
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditTeam}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editTeamName">Team Name</Label>
                <Input
                  id="editTeamName"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <ButtonLoading />}
                {loading ? 'Updating...' : 'Update Team'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Team Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {teamToDelete?.name}? This will remove all event assignments for this team.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTeam} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}
