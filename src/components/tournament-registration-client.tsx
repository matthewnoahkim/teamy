'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
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
  teams: { id: string; name: string }[]
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
}

export function TournamentRegistrationClient({
  tournament,
  registrations,
  user,
  userClubs,
}: TournamentRegistrationClientProps) {
  const { toast } = useToast()
  
  // Registration state
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [selectedClub, setSelectedClub] = useState<string>('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
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

    setRegistering(true)
    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId: selectedClub,
          teamIds: selectedTeams,
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-teamy-primary dark:bg-slate-900 shadow-nav">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="md" href="/" variant="light" />
          <div className="flex items-center gap-4">
            <ThemeToggle variant="header" />
            {user ? (
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href={`/login?callbackUrl=${encodeURIComponent(`/tournaments/${tournamentSlug}/register`)}`}>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

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
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Register for {tournament.name}</DialogTitle>
                        <DialogDescription>
                          Select your club and teams to register for this tournament.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        {/* Club Selection */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Select Club</label>
                          <Select value={selectedClub} onValueChange={(v) => {
                            setSelectedClub(v)
                            setSelectedTeams([])
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
                                        setSelectedTeams([...selectedTeams, team.id])
                                      } else {
                                        setSelectedTeams(selectedTeams.filter(id => id !== team.id))
                                      }
                                    }}
                                  />
                                  <span>{team.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedClub && eligibleTeams.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No teams found in this club. Create teams in your club settings first.
                          </p>
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
                    <Link href="/dashboard">
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
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            </div>
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Teamy. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

