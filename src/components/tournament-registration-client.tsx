'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from 'next-auth/react'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import { Pencil, LogOut, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Trophy, 
  Calendar,
  DollarSign,
  Users,
  CalendarCheck,
  Tag,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Building,
  User,
  Mail,
  CreditCard,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { format, isBefore, isAfter } from 'date-fns'
import { formatDivision, divisionsMatch } from '@/lib/utils'
import type { Division } from '@prisma/client'

interface Tournament {
  id: string
  name: string
  slug: string | null
  division: string
  description: string | null
  isOnline: boolean
  startDate: string
  endDate: string
  location: string | null
  price: number
  additionalTeamPrice: number | null
  feeStructure: string
  registrationStartDate: string | null
  registrationEndDate: string | null
  earlyBirdDiscount: number | null
  earlyBirdDeadline: string | null
  lateFee: number | null
  lateFeeStartDate: string | null
  eligibilityRequirements: string | null
  directorName: string | null
  directorEmail: string | null
  eventsRun: string | null
  trialEvents: string | null
}

interface Registration {
  id: string
  status: string
  paid: boolean
  createdAt: string
  club: {
    id: string
    name: string
    division: string
  }
  team: {
    id: string
    name: string
  } | null
  registeredBy: {
    id: string
    name: string | null
    email: string
  }
}

interface UserClub {
  id: string
  name: string
  division: string
  teams: Array<{
    id: string
    name: string
    members: Array<{
      id: string
      userId: string
      role: string
      roles: string[]
      name: string
      email: string | null
    }>
  }>
}

interface AvailableEvent {
  id: string
  name: string
  slug: string
  division: 'B' | 'C'
}

interface AvailableTrialEvent {
  name: string
  division: 'B' | 'C'
}

type TeamSelectionState = {
  eventIds: string[]
  trialEventKeys: string[]
}

interface ConflictBlock {
  id: string
  division: Division
  blockNumber: number
  name: string
  events: Array<{
    id: string
    name: string
    division: Division
  }>
}

interface TournamentRegistrationClientProps {
  tournament: Tournament
  registrations: Registration[]
  user?: {
    id?: string
    name?: string | null
    email?: string | null
  }
  userClubs: UserClub[]
  availableEvents: AvailableEvent[]
  availableTrialEvents: AvailableTrialEvent[]
  defaultMemberAssignments: Record<string, Record<string, { eventIds: string[]; eventNames: string[] }>>
  conflictBlocks: ConflictBlock[]
}

export function TournamentRegistrationClient({
  tournament,
  registrations,
  user,
  userClubs,
  availableEvents,
  availableTrialEvents,
  defaultMemberAssignments,
  conflictBlocks,
}: TournamentRegistrationClientProps) {
  const { toast } = useToast()
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user?.name ?? null)
  
  // Registration state
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [selectedClub, setSelectedClub] = useState<string>('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [teamMemberSelections, setTeamMemberSelections] = useState<Record<string, Record<string, TeamSelectionState>>>({})
  const [activeMemberByTeam, setActiveMemberByTeam] = useState<Record<string, string>>({})
  const [registering, setRegistering] = useState(false)

  // Registration helpers
  const now = new Date()
  const registrationOpen = tournament.registrationStartDate 
    ? isAfter(now, new Date(tournament.registrationStartDate)) 
    : true
  const registrationClosed = tournament.registrationEndDate 
    ? isAfter(now, new Date(tournament.registrationEndDate)) 
    : false
  const canRegister = registrationOpen && !registrationClosed

  const isEarlyBird = tournament.earlyBirdDeadline 
    ? isBefore(now, new Date(tournament.earlyBirdDeadline)) 
    : false
  const isLateFee = tournament.lateFeeStartDate 
    ? isAfter(now, new Date(tournament.lateFeeStartDate)) 
    : false

  // Filter clubs by division compatibility
  const eligibleClubs = userClubs.filter(club => 
    divisionsMatch(club.division, tournament.division)
  )

  const selectedClubData = eligibleClubs.find(c => c.id === selectedClub)
  const eligibleTeams = selectedClubData?.teams || []
  const eligibleTeamById = useMemo(
    () => new Map(eligibleTeams.map((team) => [team.id, team])),
    [eligibleTeams]
  )
  const selectedClubDivision = selectedClubData?.division

  const availableEventIds = useMemo(() => new Set(availableEvents.map(event => event.id)), [availableEvents])
  const availableEventsById = useMemo(
    () => new Map(availableEvents.map((event) => [event.id, event])),
    [availableEvents]
  )
  const trialEventKey = (trialEvent: AvailableTrialEvent) => `${trialEvent.name.toLowerCase()}::${trialEvent.division}`
  const trialEventsByKey = useMemo(
    () => new Map(availableTrialEvents.map(event => [trialEventKey(event), event])),
    [availableTrialEvents]
  )
  const eventNameNormalize = (name: string) => name.trim().toLowerCase()

  const filteredTrialEvents = useMemo(() => {
    if (!selectedClubDivision) return availableTrialEvents
    if (selectedClubDivision === 'B&C' || tournament.division !== 'B&C') return availableTrialEvents
    return availableTrialEvents.filter(event => event.division === selectedClubDivision)
  }, [availableTrialEvents, selectedClubDivision, tournament.division])

  const conflictBlocksWithEvents = useMemo(() => {
    return conflictBlocks
      .map((block) => ({
        ...block,
        events: block.events
          .map((event) => availableEventsById.get(event.id))
          .filter((event): event is AvailableEvent => !!event)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((block) => block.events.length > 0)
      .sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber - b.blockNumber
        }
        return a.division.localeCompare(b.division)
      })
  }, [availableEventsById, conflictBlocks])

  const conflictedEventIds = useMemo(() => {
    const ids = new Set<string>()
    for (const block of conflictBlocksWithEvents) {
      for (const event of block.events) {
        ids.add(event.id)
      }
    }
    return ids
  }, [conflictBlocksWithEvents])

  const uncategorizedEvents = useMemo(() => {
    return availableEvents
      .filter((event) => !conflictedEventIds.has(event.id))
      .sort((a, b) => {
        if (a.division !== b.division) {
          return a.division.localeCompare(b.division)
        }
        return a.name.localeCompare(b.name)
      })
  }, [availableEvents, conflictedEventIds])

  const getTeamMembers = (teamId: string) => eligibleTeamById.get(teamId)?.members ?? []

  const getInitialMemberSelection = (teamId: string, membershipId: string): TeamSelectionState => {
    const defaults = defaultMemberAssignments[teamId]?.[membershipId]
    if (!defaults) return { eventIds: [], trialEventKeys: [] }

    const defaultEventIds = defaults.eventIds.filter(eventId => availableEventIds.has(eventId))
    const defaultNames = new Set(defaults.eventNames.map(eventNameNormalize))

    const defaultTrialKeys = filteredTrialEvents
      .filter(trialEvent => defaultNames.has(eventNameNormalize(trialEvent.name)))
      .map(trialEventKey)

    return {
      eventIds: Array.from(new Set(defaultEventIds)),
      trialEventKeys: Array.from(new Set(defaultTrialKeys)),
    }
  }

  const getMemberSelection = (teamId: string, membershipId: string): TeamSelectionState =>
    teamMemberSelections[teamId]?.[membershipId] ?? getInitialMemberSelection(teamId, membershipId)

  const updateMemberEventSelection = (
    teamId: string,
    membershipId: string,
    eventId: string,
    checked: boolean
  ) => {
    const current = getMemberSelection(teamId, membershipId)
    const nextEventIds = checked
      ? Array.from(new Set([...current.eventIds, eventId]))
      : current.eventIds.filter(id => id !== eventId)

    setTeamMemberSelections(prev => ({
      ...prev,
      [teamId]: {
        ...(prev[teamId] ?? {}),
        [membershipId]: {
          ...current,
          eventIds: nextEventIds,
        },
      },
    }))
  }

  const updateMemberTrialSelection = (
    teamId: string,
    membershipId: string,
    trialKey: string,
    checked: boolean
  ) => {
    const current = getMemberSelection(teamId, membershipId)
    const nextTrialEventKeys = checked
      ? Array.from(new Set([...current.trialEventKeys, trialKey]))
      : current.trialEventKeys.filter(key => key !== trialKey)

    setTeamMemberSelections(prev => ({
      ...prev,
      [teamId]: {
        ...(prev[teamId] ?? {}),
        [membershipId]: {
          ...current,
          trialEventKeys: nextTrialEventKeys,
        },
      },
    }))
  }

  const getMemberConflictWarnings = (teamId: string, membershipId: string) => {
    const selection = getMemberSelection(teamId, membershipId)
    const selectedEventIds = new Set(selection.eventIds)

    return conflictBlocksWithEvents
      .map((block) => {
        const overlappingEvents = block.events
          .filter((event) => selectedEventIds.has(event.id))
          .map((event) => event.name)
        return {
          block,
          overlappingEvents,
        }
      })
      .filter((entry) => entry.overlappingEvents.length > 1)
  }

  const getTeamCoverage = (teamId: string) => {
    const members = getTeamMembers(teamId)
    const teamEventIds = new Set<string>()
    const teamTrialKeys = new Set<string>()

    const memberAssignments = members
      .map((member) => {
        const selection = getMemberSelection(teamId, member.id)
        const eventIds = Array.from(new Set(selection.eventIds))
        const trialEventSelections = Array.from(new Set(selection.trialEventKeys))
          .map((key) => trialEventsByKey.get(key))
          .filter((event): event is AvailableTrialEvent => !!event)
          .map((event) => ({
            name: event.name,
            division: event.division,
          }))

        for (const eventId of eventIds) {
          teamEventIds.add(eventId)
        }
        for (const trialKey of selection.trialEventKeys) {
          teamTrialKeys.add(trialKey)
        }

        return {
          membershipId: member.id,
          eventIds,
          trialEventSelections,
        }
      })
      .filter((assignment) => assignment.eventIds.length > 0 || assignment.trialEventSelections.length > 0)

    const trialEventSelections = Array.from(teamTrialKeys)
      .map((key) => trialEventsByKey.get(key))
      .filter((event): event is AvailableTrialEvent => !!event)
      .map((event) => ({
        name: event.name,
        division: event.division,
      }))

    return {
      eventIds: Array.from(teamEventIds),
      trialEventSelections,
      memberAssignments,
    }
  }

  // Calculate price
  const calculatePrice = () => {
    let basePrice = tournament.price
    let additionalPrice = tournament.additionalTeamPrice || tournament.price
    
    if (isEarlyBird && tournament.earlyBirdDiscount) {
      basePrice = basePrice - tournament.earlyBirdDiscount
      additionalPrice = additionalPrice - tournament.earlyBirdDiscount
    }
    
    if (isLateFee && tournament.lateFee) {
      basePrice = basePrice + tournament.lateFee
      additionalPrice = additionalPrice + tournament.lateFee
    }

    if (selectedTeams.length === 0) return 0
    
    if (tournament.feeStructure === 'FLAT') {
      return basePrice * selectedTeams.length
    } else {
      // First team + additional teams
      return basePrice + (additionalPrice * (selectedTeams.length - 1))
    }
  }

  const handleRegister = async () => {
    if (!selectedClub || selectedTeams.length === 0) return

    for (const teamId of selectedTeams) {
      const coverage = getTeamCoverage(teamId)
      const teamName = eligibleTeamById.get(teamId)?.name || 'Selected team'

      if (coverage.memberAssignments.length === 0) {
        toast({
          title: 'Member Assignments Required',
          description: `${teamName} must have at least one member assigned to a regular or trial event.`,
          variant: 'destructive',
        })
        return
      }
    }

    const teamSelectionsPayload = Object.fromEntries(
      selectedTeams.map((teamId) => {
        const coverage = getTeamCoverage(teamId)

        return [
          teamId,
          {
            eventIds: coverage.eventIds,
            trialEventSelections: coverage.trialEventSelections,
            memberAssignments: coverage.memberAssignments,
          },
        ]
      })
    )

    setRegistering(true)
    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: selectedClub,
          teamIds: selectedTeams,
          teamSelections: teamSelectionsPayload,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to register')
      }

      toast({
        title: 'Registration Submitted!',
        description: `Successfully registered ${selectedTeams.length} team${selectedTeams.length > 1 ? 's' : ''} for this tournament.`,
      })
      setRegisterDialogOpen(false)
      setSelectedClub('')
      setSelectedTeams([])
      setTeamMemberSelections({})
      setActiveMemberByTeam({})
      
      // Refresh page to show new registration
      window.location.reload()
    } catch (error) {
      toast({
        title: 'Registration Failed',
        description: error instanceof Error ? error.message : 'Failed to register for tournament',
        variant: 'destructive',
      })
    } finally {
      setRegistering(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-green-500">Confirmed</Badge>
      case 'PENDING':
        return <Badge variant="outline">Pending</Badge>
      case 'WAITLISTED':
        return <Badge variant="secondary">Waitlisted</Badge>
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const tournamentSlug = tournament.slug || tournament.id

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Sign out error', error)
    }
  }

  return (
    <div className="min-h-screen bg-background grid-pattern flex flex-col">
      {/* Header */}
      <header className="floating-bar-shell floating-bar-shell-top">
        <div className="container mx-auto floating-bar-content px-4 flex items-center justify-between">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-4">
            {user && user.id ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 sm:gap-3 outline-none">
                    <Avatar 
                      className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer ring-2 ring-white/30 hover:ring-white/50 transition-all"
                    >
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="bg-white/20 text-white font-semibold text-sm">
                        {currentUserName?.charAt(0) || (user.email || '').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left max-w-[120px] md:max-w-none">
                      <p className="text-xs sm:text-sm font-medium text-white truncate">
                        {currentUserName || user.email}
                      </p>
                      <p className="text-[10px] sm:text-xs text-white/60 truncate">{user.email}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-white/60 hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setEditUsernameOpen(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Username
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-default">
                    <ThemeToggle variant="menu" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/tournaments/${tournamentSlug}/register`)}`} className="hidden md:block">
                <button className="px-5 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold bg-white text-teamy-primary rounded-full hover:bg-white/90 transition-colors whitespace-nowrap shadow-sm">
                  Sign In
                </button>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      {user && user.id && (
        <EditUsernameDialog
          open={editUsernameOpen}
          onOpenChange={setEditUsernameOpen}
          currentName={currentUserName}
          onNameUpdated={setCurrentUserName}
        />
      )}

      <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        {/* Back link */}
        <Link 
          href={`/tournaments/${tournamentSlug}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tournament
        </Link>

        {/* Tournament Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            <Badge variant="outline" className="text-lg px-3">
              {formatDivision(tournament.division)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {format(new Date(tournament.startDate), 'MMMM d, yyyy')}
            {tournament.location && ` • ${tournament.location}`}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Registration Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Registration Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Registration Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Fee Structure */}
                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Registration Fee</p>
                    <p className="text-sm text-muted-foreground">
                      {tournament.price === 0 ? 'Free' : (
                        tournament.feeStructure === 'FLAT' 
                          ? `$${tournament.price} per team`
                          : `$${tournament.price} for first team${tournament.additionalTeamPrice ? `, $${tournament.additionalTeamPrice} for additional teams` : ''}`
                      )}
                    </p>
                  </div>
                </div>

                {/* Registration Window */}
                {(tournament.registrationStartDate || tournament.registrationEndDate) && (
                  <div className="flex items-start gap-3">
                    <CalendarCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Registration Window</p>
                      <p className="text-sm text-muted-foreground">
                        {tournament.registrationStartDate && (
                          <>Opens: {format(new Date(tournament.registrationStartDate), 'MMM d, yyyy h:mm a')}</>
                        )}
                        {tournament.registrationStartDate && tournament.registrationEndDate && <br />}
                        {tournament.registrationEndDate && (
                          <>Closes: {format(new Date(tournament.registrationEndDate), 'MMM d, yyyy h:mm a')}</>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Early Bird Discount */}
                {tournament.earlyBirdDiscount && tournament.earlyBirdDeadline && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        Early Bird Discount
                        {isEarlyBird && <Badge className="ml-2 bg-green-500 text-xs">Active</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Save ${tournament.earlyBirdDiscount} per team
                        {!isEarlyBird 
                          ? ' (expired)'
                          : ` until ${format(new Date(tournament.earlyBirdDeadline), 'MMM d, yyyy')}`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Late Fee */}
                {tournament.lateFee && tournament.lateFeeStartDate && (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-orange-600 dark:text-orange-400">
                        Late Fee
                        {isLateFee && <Badge className="ml-2 bg-orange-500 text-xs">Active</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${tournament.lateFee} additional fee per team
                        {isLateFee 
                          ? ' (now in effect)'
                          : ` starting ${format(new Date(tournament.lateFeeStartDate), 'MMM d, yyyy')}`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Eligibility */}
                {tournament.eligibilityRequirements && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Eligibility Requirements</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {tournament.eligibilityRequirements}
                      </p>
                    </div>
                  </div>
                )}

                {/* Contact */}
                {(tournament.directorName || tournament.directorEmail) && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Tournament Contact</p>
                      <p className="text-sm text-muted-foreground">
                        {tournament.directorName}
                        {tournament.directorEmail && (
                          <>
                            <br />
                            <a href={`mailto:${tournament.directorEmail}`} className="text-teamy-primary hover:underline">
                              {tournament.directorEmail}
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Registered Teams */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Registered Teams
                  <Badge variant="secondary" className="ml-2">{registrations.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Teams currently registered for this tournament
                </CardDescription>
              </CardHeader>
              <CardContent>
                {registrations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No teams registered yet.</p>
                    <p className="text-sm">Be the first to register!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Club</TableHead>
                        <TableHead>Division</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrations.map((reg) => (
                        <TableRow key={reg.id}>
                          <TableCell className="font-medium">
                            {reg.team?.name || 'Club Registration'}
                          </TableCell>
                          <TableCell>{reg.club.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{formatDivision(reg.club.division)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(reg.status)}
                              {reg.paid && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Paid
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(reg.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Register Action */}
          <div className="space-y-6">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Register Your Team
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status Badges */}
                <div className="space-y-2">
                  {!registrationOpen && tournament.registrationStartDate && (
                    <Badge variant="outline" className="w-full justify-center h-12 items-center text-base font-semibold">
                      <Clock className="h-5 w-5 mr-2" />
                      Opens {format(new Date(tournament.registrationStartDate), 'MMM d, yyyy')}
                    </Badge>
                  )}
                  
                  {registrationClosed && (
                    <Badge variant="destructive" className="w-full justify-center h-12 items-center text-base font-semibold">
                      Registration Closed
                    </Badge>
                  )}

                  {canRegister && registrationOpen && (
                    <Badge className="w-full justify-center h-12 items-center text-base font-semibold bg-green-500">
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Registration Open
                    </Badge>
                  )}
                </div>

                {/* Register Button */}
                {canRegister && user && eligibleClubs.length > 0 && (
                  <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="w-full gap-2">
                        <Trophy className="h-5 w-5" />
                        Register Now
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Register for {tournament.name}</DialogTitle>
                        <DialogDescription>
                          Select your club and teams, then confirm who takes which regular and trial events.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        {/* Club Selection */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Select Club</label>
                          <Select value={selectedClub} onValueChange={(v) => {
                            setSelectedClub(v)
                            setSelectedTeams([])
                            setTeamMemberSelections({})
                            setActiveMemberByTeam({})
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a club..." />
                            </SelectTrigger>
                            <SelectContent>
                              {eligibleClubs.map(club => (
                                <SelectItem key={club.id} value={club.id}>
                                  {club.name} ({formatDivision(club.division)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Team Selection */}
                        {selectedClub && eligibleTeams.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Select Teams</label>
                            <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                              {eligibleTeams.map(team => (
                                <label 
                                  key={team.id} 
                                  className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={selectedTeams.includes(team.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedTeams((prev) =>
                                          prev.includes(team.id) ? prev : [...prev, team.id]
                                        )
                                        setActiveMemberByTeam((prev) => {
                                          if (prev[team.id]) return prev
                                          const firstMemberId = team.members[0]?.id
                                          if (!firstMemberId) return prev
                                          return {
                                            ...prev,
                                            [team.id]: firstMemberId,
                                          }
                                        })
                                      } else {
                                        setSelectedTeams((prev) => prev.filter(id => id !== team.id))
                                        setTeamMemberSelections((prev) => {
                                          const next = { ...prev }
                                          delete next[team.id]
                                          return next
                                        })
                                        setActiveMemberByTeam((prev) => {
                                          const next = { ...prev }
                                          delete next[team.id]
                                          return next
                                        })
                                      }
                                    }}
                                  />
                                  <span>{team.name}</span>
                                </label>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Assign members to events for this tournament. Existing roster assignments are pre-filled and editable.
                            </p>
                          </div>
                        )}

                        {selectedClub && eligibleTeams.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No teams found in this club. Create teams in your club settings first.
                          </p>
                        )}

                        {selectedTeams.length > 0 && (
                          <div className="space-y-4">
                            <div className="border rounded-md p-4 bg-muted/30">
                              <p className="text-sm font-medium mb-1">Assign Members to Events</p>
                              <p className="text-xs text-muted-foreground">
                                Pick a team member, assign their events, and review conflict block warnings before submitting.
                              </p>
                            </div>

                            {selectedTeams.map((teamId) => {
                              const team = eligibleTeamById.get(teamId)
                              const members = getTeamMembers(teamId)
                              const selectedMemberId = activeMemberByTeam[teamId] || members[0]?.id || ''
                              const selectedMember = members.find((member) => member.id === selectedMemberId) || members[0] || null
                              const selectedMemberSelection = selectedMember
                                ? getMemberSelection(teamId, selectedMember.id)
                                : { eventIds: [], trialEventKeys: [] }
                              const selectedMemberConflictWarnings = selectedMember
                                ? getMemberConflictWarnings(teamId, selectedMember.id)
                                : []

                              return (
                                <div key={teamId} className="border rounded-md p-4 space-y-4">
                                  <h4 className="font-semibold">{team?.name || 'Team'}</h4>

                                  {members.length === 0 && (
                                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                      This team has no members. Add members to this team before registering.
                                    </div>
                                  )}

                                  {members.length > 0 && (
                                    <>
                                      <div className="space-y-3">
                                        <p className="text-sm font-medium">Team Members</p>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                          {members.map((member) => {
                                            const memberSelection = getMemberSelection(teamId, member.id)
                                            const memberConflicts = getMemberConflictWarnings(teamId, member.id)
                                            const assignmentCount =
                                              memberSelection.eventIds.length + memberSelection.trialEventKeys.length
                                            const isActive = selectedMember?.id === member.id

                                            return (
                                              <button
                                                key={member.id}
                                                type="button"
                                                onClick={() =>
                                                  setActiveMemberByTeam((prev) => ({
                                                    ...prev,
                                                    [teamId]: member.id,
                                                  }))
                                                }
                                                className={`rounded-md border p-3 text-left transition-colors ${
                                                  isActive
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-border bg-background hover:bg-muted/40'
                                                }`}
                                              >
                                                <p className="text-sm font-medium">{member.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                  {assignmentCount} assignment{assignmentCount === 1 ? '' : 's'}
                                                </p>
                                                {memberConflicts.length > 0 && (
                                                  <p className="mt-1 text-xs text-destructive">
                                                    {memberConflicts.length} conflict block
                                                    {memberConflicts.length === 1 ? '' : 's'} overlap
                                                  </p>
                                                )}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </div>

                                      {selectedMember && (
                                        <div className="space-y-3">
                                          <p className="text-sm font-medium">Assign events for {selectedMember.name}</p>

                                          {selectedMemberConflictWarnings.length > 0 && (
                                            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                                              <div className="mb-1 flex items-center gap-2 font-medium">
                                                <AlertCircle className="h-4 w-4" />
                                                Schedule conflict warning
                                              </div>
                                              <div className="space-y-1 text-xs">
                                                {selectedMemberConflictWarnings.map((entry) => (
                                                  <p key={`${teamId}-${selectedMember.id}-${entry.block.id}`}>
                                                    Block {entry.block.blockNumber}
                                                    {tournament.division === 'B&C' ? ` (Div ${entry.block.division})` : ''}: {entry.overlappingEvents.join(', ')}
                                                  </p>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          <div className="space-y-3">
                                            <p className="text-sm font-medium">Official Events by Conflict Block</p>
                                            {conflictBlocksWithEvents.length === 0 ? (
                                              <p className="text-xs text-muted-foreground">
                                                No conflict blocks are configured for this tournament division.
                                              </p>
                                            ) : (
                                              <div className="space-y-3">
                                                {conflictBlocksWithEvents.map((block) => (
                                                  <div key={block.id} className="rounded-md border p-3">
                                                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                                                      Block {block.blockNumber}: {block.name}
                                                      {tournament.division === 'B&C' ? ` (Division ${block.division})` : ''}
                                                    </p>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                      {block.events.map((event) => (
                                                        <label key={event.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted/50">
                                                          <Checkbox
                                                            checked={selectedMemberSelection.eventIds.includes(event.id)}
                                                            onCheckedChange={(checked) => {
                                                              updateMemberEventSelection(
                                                                teamId,
                                                                selectedMember.id,
                                                                event.id,
                                                                checked === true
                                                              )
                                                            }}
                                                          />
                                                          <span className="text-sm">{event.name}</span>
                                                        </label>
                                                      ))}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {uncategorizedEvents.length > 0 && (
                                              <div className="rounded-md border p-3">
                                                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                                                  Events without conflict block
                                                </p>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                  {uncategorizedEvents.map((event) => (
                                                    <label key={event.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted/50">
                                                      <Checkbox
                                                        checked={selectedMemberSelection.eventIds.includes(event.id)}
                                                        onCheckedChange={(checked) => {
                                                          updateMemberEventSelection(
                                                            teamId,
                                                            selectedMember.id,
                                                            event.id,
                                                            checked === true
                                                          )
                                                        }}
                                                      />
                                                      <span className="text-sm">
                                                        {event.name}
                                                        {tournament.division === 'B&C' ? (
                                                          <span className="text-muted-foreground"> (Div {event.division})</span>
                                                        ) : null}
                                                      </span>
                                                    </label>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          <div className="space-y-3">
                                            <p className="text-sm font-medium">Trial Events</p>
                                            {filteredTrialEvents.length === 0 ? (
                                              <p className="text-xs text-muted-foreground">No trial events configured for this tournament.</p>
                                            ) : (
                                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {filteredTrialEvents.map((trialEvent) => {
                                                  const key = trialEventKey(trialEvent)
                                                  return (
                                                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted/50">
                                                      <Checkbox
                                                        checked={selectedMemberSelection.trialEventKeys.includes(key)}
                                                        onCheckedChange={(checked) => {
                                                          updateMemberTrialSelection(
                                                            teamId,
                                                            selectedMember.id,
                                                            key,
                                                            checked === true
                                                          )
                                                        }}
                                                      />
                                                      <span className="text-sm">
                                                        {trialEvent.name}
                                                        {tournament.division === 'B&C' ? (
                                                          <span className="text-muted-foreground"> (Div {trialEvent.division})</span>
                                                        ) : (
                                                          <span className="text-muted-foreground"> (Trial)</span>
                                                        )}
                                                      </span>
                                                    </label>
                                                  )
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Price Summary */}
                        {selectedTeams.length > 0 && (
                          <div className="border rounded-md p-4 bg-muted/50 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Teams selected:</span>
                              <span className="font-medium">{selectedTeams.length}</span>
                            </div>
                            {isEarlyBird && tournament.earlyBirdDiscount && (
                              <div className="flex justify-between text-sm text-green-600">
                                <span>Early bird discount:</span>
                                <span>-${tournament.earlyBirdDiscount * selectedTeams.length}</span>
                              </div>
                            )}
                            {isLateFee && tournament.lateFee && (
                              <div className="flex justify-between text-sm text-orange-600">
                                <span>Late fee:</span>
                                <span>+${tournament.lateFee * selectedTeams.length}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-medium pt-2 border-t">
                              <span>Total:</span>
                              <span>${calculatePrice()}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleRegister} 
                          disabled={registering || !selectedClub || selectedTeams.length === 0}
                        >
                          {registering ? 'Registering...' : 'Submit Registration'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {canRegister && user && eligibleClubs.length === 0 && userClubs.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    None of your clubs match the tournament division ({formatDivision(tournament.division)}).
                  </p>
                )}

                {canRegister && user && userClubs.length === 0 && (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      You need to be a club admin to register teams.
                    </p>
                    <Link href="/no-clubs">
                      <Button variant="outline" size="sm" className="gap-2 transition-colors hover:bg-muted/50">
                        <Building className="h-4 w-4" />
                        Go to Dashboard
                      </Button>
                    </Link>
                  </div>
                )}

                {canRegister && !user && (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Sign in to register your team for this tournament.
                    </p>
                    <Link href={`/login?callbackUrl=${encodeURIComponent(`/tournaments/${tournamentSlug}/register`)}`}>
                      <Button className="w-full gap-2">
                        <User className="h-4 w-4" />
                        Sign In to Register
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Tournament Info Summary */}
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(tournament.startDate), 'MMMM d, yyyy')}</span>
                  </div>
                  {tournament.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{tournament.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{registrations.length} team{registrations.length !== 1 ? 's' : ''} registered</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4 mt-auto">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
            <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-xs sm:text-sm text-muted-foreground">
                © {new Date().getFullYear()} Teamy. All rights reserved.
              </p>
              
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

