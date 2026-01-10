'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import { 
  Trophy, 
  LogOut, 
  Clock, 
  XCircle, 
  CheckCircle2,
  MapPin, 
  Calendar,
  Bell,
  ChevronRight,
  ChevronDown,
  Pencil,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatDivision } from '@/lib/utils'

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
  createdAt: string | Date
  tournament?: {
    id: string
    name: string
    division: string
    startDate: string
    endDate: string
  } | null
}

interface TDPortalClientProps {
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  requests: TournamentRequest[]
}

export function TDPortalClient({ user, requests }: TDPortalClientProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user.name ?? null)

  // Helper functions for formatting
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
        return format.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-')
    }
  }

  // Filter requests by status
  const approvedRequests = requests.filter(r => r.status === 'APPROVED')
  const pendingRequests = requests.filter(r => r.status === 'PENDING')
  const rejectedRequests = requests.filter(r => r.status === 'REJECTED')
  
  // Notifications include all non-approved requests plus recently approved ones
  const notifications = requests.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  // Count only pending/rejected as "unread"
  const unreadCount = pendingRequests.length + rejectedRequests.length

  const handleSignOut = () => {
    signOut({ callbackUrl: '/td' })
  }

  return (
    <div className="min-h-screen bg-background grid-pattern flex flex-col">
      {/* Header */}
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" href="/" variant="light" />
            <div className="h-6 w-px bg-white/20" />
            <span className="text-white font-semibold">TD Portal</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative px-2 text-white hover:bg-white/10"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="border-b px-4 py-3">
                  <h3 className="font-semibold">Request Updates</h3>
                  <p className="text-xs text-muted-foreground">Status of your tournament requests</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No tournament requests yet
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map(request => (
                        <div key={request.id} className="p-4 hover:bg-muted/50">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 p-1.5 rounded-full ${
                              request.status === 'APPROVED'
                                ? 'bg-green-500/10'
                                : request.status === 'PENDING'
                                  ? 'bg-yellow-500/10'
                                  : 'bg-red-500/10'
                            }`}>
                              {request.status === 'APPROVED' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : request.status === 'PENDING' ? (
                                <Clock className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{request.tournamentName}</p>
                              <p className={`text-xs ${
                                request.status === 'APPROVED'
                                  ? 'text-green-600 dark:text-green-400'
                                  : request.status === 'PENDING'
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                              }`}>
                                {request.status === 'APPROVED' 
                                  ? 'Request approved!'
                                  : request.status === 'PENDING' 
                                    ? 'Pending review' 
                                    : 'Request rejected'}
                              </p>
                              {request.reviewNotes && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {request.reviewNotes}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {format(new Date(request.createdAt), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 sm:gap-3 outline-none">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer ring-2 ring-white/30 hover:ring-white/50 transition-all">
                    <AvatarImage src={user.image || ''} />
                    <AvatarFallback className="bg-white/20 text-white font-semibold text-sm">
                      {currentUserName?.charAt(0) || user.email.charAt(0).toUpperCase()}
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
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle variant="header" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome, {user.name?.split(' ')[0] || 'Tournament Director'}!
          </h1>
          <p className="text-muted-foreground">
            Manage your tournaments, invite staff, and set deadlines.
          </p>
        </div>

        {/* Approved Tournaments */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Your Tournaments</h2>
          
          {approvedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No Approved Tournaments Yet</h3>
                <p className="text-muted-foreground">
                  {pendingRequests.length > 0 
                    ? `You have ${pendingRequests.length} request${pendingRequests.length > 1 ? 's' : ''} pending review.`
                    : 'No tournament hosting requests have been approved yet.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {approvedRequests.map((request) => {
                // For staff records (prefixed with "staff-"), use tournament route
                // For regular requests, use manage route
                const isStaffRecord = request.id.startsWith('staff-')
                const href = isStaffRecord && request.tournament
                  ? `/td/tournament/${request.tournament.id}`
                  : `/td/manage/${request.id}`
                
                return (
                <Link 
                  key={request.id} 
                  href={href}
                  className="block"
                >
                  <Card className="overflow-hidden transition-all h-full cursor-pointer hover:shadow-lg hover:border-primary/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{request.tournamentName}</CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {request.tournament 
                              ? format(new Date(request.tournament.startDate), 'MMM d, yyyy')
                              : 'Click to set up'}
                          </CardDescription>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="outline">{getLevelLabel(request.tournamentLevel)}</Badge>
                        <Badge variant="outline">Division {formatDivision(request.division)}</Badge>
                        <Badge variant="outline">{getFormatLabel(request.tournamentFormat)}</Badge>
                      </div>
                      {request.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{request.location}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-4 mt-auto">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <EditUsernameDialog
        open={editUsernameOpen}
        onOpenChange={setEditUsernameOpen}
        currentName={currentUserName}
        onNameUpdated={setCurrentUserName}
      />
    </div>
  )
}
