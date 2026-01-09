'use client'

import { signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { ClipboardList, AlertCircle, Calendar, MapPin, Users } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatDivision } from '@/lib/utils'

interface InviteInfo {
  id: string
  email: string
  name: string | null
  role: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  tournament: {
    id: string
    name: string
    division: string
    startDate: string
    endDate: string
  }
  events: Array<{
    event: {
      id: string
      name: string
    }
  }>
}

interface ESLoginClientProps {
  unauthorized?: boolean
  email?: string
  inviteInfo?: InviteInfo | null
  token?: string
}

export function ESLoginClient({ unauthorized, email, inviteInfo, token }: ESLoginClientProps) {
  const handleSignIn = () => {
    signIn('google', { callbackUrl: token ? `/es?token=${token}` : '/es' })
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: token ? `/es?token=${token}` : '/es' })
  }

  const roleLabel = inviteInfo?.role === 'EVENT_SUPERVISOR' ? 'Event Supervisor' : 'Tournament Director'

  return (
    <div className="min-h-screen bg-background text-foreground grid-pattern">
      {/* Header */}
      <header className="sticky top-4 z-50 mx-4 rounded-2xl border border-white/10 bg-teamy-primary/90 dark:bg-popover/90 backdrop-blur-xl shadow-lg dark:shadow-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="md" href="/" variant="light" />
            <div className="h-6 w-px bg-white/20" />
            <span className="text-white font-semibold">Event Supervisor Portal</span>
          </div>
          <ThemeToggle variant="header" />
        </div>
      </header>

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="inline-flex p-4 rounded-2xl bg-teamy-primary/10 mx-auto mb-4">
              <ClipboardList className="h-10 w-10 text-teamy-primary" />
            </div>
            <CardTitle className="text-2xl">
              {unauthorized ? 'Access Denied' : inviteInfo ? "You're Invited!" : 'Event Supervisor Portal'}
            </CardTitle>
            <CardDescription className="text-base">
              {unauthorized 
                ? 'Your email is not associated with any tournament staff invitation.'
                : inviteInfo
                  ? `You've been invited to join ${inviteInfo.tournament.name}`
                  : 'Sign in with your invited email to access your tournament assignments.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invitation Details */}
            {inviteInfo && !unauthorized && (
              <div className="space-y-4">
                <div className="p-4 bg-teamy-primary/5 dark:bg-white/5 rounded-xl border border-teamy-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-teamy-primary/10 text-teamy-primary border-teamy-primary/20">
                      {roleLabel}
                    </Badge>
                    <Badge variant="outline" className="border-teamy-primary/30">
                      Division {formatDivision(inviteInfo.tournament.division)}
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2">{inviteInfo.tournament.name}</h3>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-teamy-primary" />
                      <span>
                        {format(new Date(inviteInfo.tournament.startDate), 'MMM d')} - {format(new Date(inviteInfo.tournament.endDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    
                    {inviteInfo.events.length > 0 && (
                      <div className="flex items-start gap-2 pt-2">
                        <Users className="h-4 w-4 text-teamy-primary mt-0.5" />
                        <div>
                          <span className="font-medium">Your Events:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {inviteInfo.events.map(e => (
                              <Badge key={e.event.id} variant="secondary" className="text-xs">
                                {e.event.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  Sign in with <strong>{inviteInfo.email}</strong> to accept your invitation
                </p>
              </div>
            )}

            {unauthorized ? (
              <>
                <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">
                        No invitation found
                      </p>
                      <p className="text-sm text-muted-foreground">
                        The email <strong>{email}</strong> is not associated with any tournament staff invitation. 
                        Please sign in with the email that received the invitation.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button onClick={handleSignOut} variant="outline" className="w-full">
                    Sign Out & Try Different Email
                  </Button>
                  <Link href="/" className="w-full">
                    <Button variant="default" className="w-full">
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <Button 
                  onClick={handleSignIn} 
                  className="w-full h-12 gap-3"
                  variant="outline"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {inviteInfo ? 'Accept Invitation & Sign In' : 'Sign in with Google'}
                </Button>
                {!inviteInfo && (
                  <p className="text-xs text-center text-muted-foreground">
                    You need an invitation from a Tournament Director to access this portal.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

