'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountSecurityMenuItem } from '@/components/account-security-menu-item'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditUsernameDialog } from '@/components/edit-username-dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  Trophy, 
  LogOut, 
  Clock, 
  XCircle, 
  CheckCircle2,
  MapPin, 
  Calendar,
  ChevronRight,
  ChevronDown,
  Pencil,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatDivision } from '@/lib/utils'
import { useBackgroundRefresh } from '@/hooks/use-background-refresh'
import {
  getLatestTDPortalNotificationSeenAt,
  getTDPortalNotificationTimestamp,
  getTDPortalUnreadCount,
  isTDPortalRequestNotification,
  isTDPortalNotificationUnread,
} from '@/lib/td-portal-notifications'

export interface TournamentRequest {
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
  updatedAt: string | Date
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
  accessibleTournaments: TournamentRequest[]
}

export function TDPortalClient({ user, requests, accessibleTournaments }: TDPortalClientProps) {
  const router = useRouter()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [editUsernameOpen, setEditUsernameOpen] = useState(false)
  const [currentUserName, setCurrentUserName] = useState(user.name ?? null)
  const [notificationsSeenAt, setNotificationsSeenAt] = useState<string | null>(null)
  const [notificationsHydrated, setNotificationsHydrated] = useState(false)

  useBackgroundRefresh(
    () => {
      router.refresh()
    },
    {
      intervalMs: 45_000,
      runOnMount: false,
      refreshOnFocus: true,
      refreshOnReconnect: true,
      enabled: true,
    },
  )

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
  const approvedTournaments = accessibleTournaments.filter(r => r.status === 'APPROVED')
  const pendingRequests = requests.filter(r => r.status === 'PENDING')
  const notificationRequests = requests.filter(isTDPortalRequestNotification)
  const notifications = [...notificationRequests].sort(
    (a, b) => getTDPortalNotificationTimestamp(b) - getTDPortalNotificationTimestamp(a)
  )
  const notificationStorageKey = `td-portal-notifications-seen-${user.id}`
  const latestNotificationSeenAt = getLatestTDPortalNotificationSeenAt(notifications)
  const unreadCount =
    notificationsHydrated && notificationsSeenAt
      ? getTDPortalUnreadCount(notifications, notificationsSeenAt)
      : 0
  const hasUnreadNotifications = unreadCount > 0
  const totalUpdatesLabel =
    notifications.length === 0
      ? 'No request updates yet'
      : `${notifications.length} request update${notifications.length === 1 ? '' : 's'}`
  const unreadUpdatesLabel = hasUnreadNotifications
    ? `${unreadCount} new update${unreadCount === 1 ? '' : 's'}`
    : notifications.length > 0
      ? 'No new updates'
      : 'No updates yet'
  const requestUpdatesDescription = hasUnreadNotifications
    ? `${unreadUpdatesLabel} for your tournament hosting requests.`
    : notifications.length > 0
      ? 'You are caught up on your tournament hosting requests.'
      : 'Status updates for your tournament hosting requests will appear here.'

  useEffect(() => {
    try {
      const storedSeenAt = localStorage.getItem(notificationStorageKey)
      if (storedSeenAt) {
        setNotificationsSeenAt(storedSeenAt)
      } else if (latestNotificationSeenAt) {
        localStorage.setItem(notificationStorageKey, latestNotificationSeenAt)
        setNotificationsSeenAt(latestNotificationSeenAt)
      }
    } catch (_error) {
      if (latestNotificationSeenAt) {
        setNotificationsSeenAt(latestNotificationSeenAt)
      }
    } finally {
      setNotificationsHydrated(true)
    }
  }, [latestNotificationSeenAt, notificationStorageKey])

  const markNotificationsRead = () => {
    if (!latestNotificationSeenAt) {
      return
    }

    setNotificationsSeenAt(latestNotificationSeenAt)
    try {
      localStorage.setItem(notificationStorageKey, latestNotificationSeenAt)
    } catch (_error) {
      // Ignore localStorage failures.
    }
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/td' })
  }

  return (
    <div className="min-h-screen bg-background grid-pattern flex flex-col">
      {/* Header */}
      <header className="floating-bar-shell floating-bar-shell-top">
        <div className="container mx-auto floating-bar-content px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" href="/" variant="light" />
            <div className="h-6 w-px bg-white/20" />
            <span className="text-white font-semibold">TD Portal</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild id={`td-user-menu-trigger-${user.id}`}>
                <button className="flex items-center gap-2 sm:gap-3 outline-none">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer ring-2 ring-white/30 hover:ring-white/50 transition-all">
                    <AvatarImage src={user.image || ''} />
                    <AvatarFallback className="bg-white/20 text-white font-semibold text-sm">
                      {currentUserName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left max-w-[120px] md:max-w-none" suppressHydrationWarning>
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
                <AccountSecurityMenuItem email={user.email} />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome, {user.name?.split(' ')[0] || 'Tournament Director'}!
            </h1>
            <p className="text-muted-foreground">
              Manage your tournaments, invite staff, and set deadlines.
            </p>
          </div>
          <Link href="/es">
            <Button variant="outline" className="w-full sm:w-auto">
              Open ES Portal
            </Button>
          </Link>
        </div>

        <Collapsible
          open={notificationsOpen}
          onOpenChange={(open) => {
            setNotificationsOpen(open)
            if (open) {
              markNotificationsRead()
            }
          }}
        >
          <Card className={`mb-8 overflow-hidden ${hasUnreadNotifications ? 'border-primary/40' : ''}`}>
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <CardHeader className="transition-colors hover:bg-muted/30">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">Request Updates</CardTitle>
                        {hasUnreadNotifications && (
                          <Badge className="bg-teamy-primary text-primary-foreground hover:bg-teamy-primary">
                            {unreadCount} new
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{requestUpdatesDescription}</CardDescription>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-medium text-foreground">
                          {unreadUpdatesLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {notificationsOpen
                            ? 'Hide updates'
                            : totalUpdatesLabel}
                        </p>
                      </div>
                      <div className="rounded-full border border-border p-2 text-muted-foreground">
                        {notificationsOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="border-t bg-muted/20 p-0">
                {notifications.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    No tournament requests yet.
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map(request => (
                      <div
                        key={request.id}
                        className={`p-4 ${
                          notificationsHydrated && isTDPortalNotificationUnread(request, notificationsSeenAt)
                            ? 'bg-muted/40'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 rounded-full p-1.5 ${
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
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-sm">{request.tournamentName}</p>
                              {notificationsHydrated &&
                                isTDPortalNotificationUnread(request, notificationsSeenAt) && (
                                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teamy-primary" />
                                )}
                            </div>
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
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {request.reviewNotes}
                              </p>
                            )}
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {format(new Date(request.updatedAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Approved Tournaments */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Your Tournaments</h2>
          
          {approvedTournaments.length === 0 ? (
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
              {approvedTournaments.map((request) => {
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
            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Teamy. All rights reserved.</p>
              
            </div>
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
