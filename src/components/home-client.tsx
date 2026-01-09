'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateClubDialog } from '@/components/create-club-dialog'
import { JoinClubDialog } from '@/components/join-club-dialog'
import { AppHeader } from '@/components/app-header'
import { Users, Plus } from 'lucide-react'
import { useFaviconBadge } from '@/hooks/use-favicon-badge'
import { useBackgroundRefresh } from '@/hooks/use-background-refresh'

interface HomeClientProps {
  memberships: any[]
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
}

export function HomeClient({ memberships: initialMemberships, user }: HomeClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [memberships, setMemberships] = useState(initialMemberships)
  const [clubNotifications, setClubNotifications] = useState<Record<string, boolean>>({})
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)

  useFaviconBadge(totalUnreadCount)

  const fetchMemberships = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const response = await fetch('/api/clubs')
      if (response.ok) {
        const data = await response.json()
        setMemberships(data.memberships || [])
      }
    } catch (error) {
      console.error('Failed to fetch memberships:', error)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [])

  // Only fetch if initial data is missing
  useEffect(() => {
    if (!initialMemberships || initialMemberships.length === 0) {
      fetchMemberships()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isDashboardRoute = pathname === '/dashboard'
  useBackgroundRefresh(
    () => fetchMemberships({ silent: true }),
    {
      intervalMs: 40_000,
      enabled: isDashboardRoute,
      runOnMount: false,
    },
  )

  const getLastClearedTime = (clubId: string): Date => {
    if (typeof window === 'undefined') return new Date(0)
    const key = `lastCleared_club_${clubId}_${user.id}`
    const stored = localStorage.getItem(key)
    return stored ? new Date(stored) : new Date(0)
  }

  const clearClubNotification = (clubId: string) => {
    if (typeof window === 'undefined') return
    const key = `lastCleared_club_${clubId}_${user.id}`
    localStorage.setItem(key, new Date().toISOString())
    setClubNotifications(prev => {
      const updated = { ...prev, [clubId]: false }
      const newCount = Object.values(updated).filter(Boolean).length
      setTotalUnreadCount(newCount)
      return updated
    })
  }

  useEffect(() => {
    const checkForNewContent = async () => {
      const notifications: Record<string, boolean> = {}
      let totalUnreadItems = 0

      for (const membership of memberships) {
        const clubId = membership.club.id
        const lastCleared = getLastClearedTime(clubId)
        let hasNew = false
        let clubUnreadCount = 0

        try {
          const streamResponse = await fetch(`/api/announcements?clubId=${clubId}`)
          if (streamResponse.ok) {
            const streamData = await streamResponse.json()
            const newAnnouncements = streamData.announcements?.filter((announcement: any) => {
              const isNew = new Date(announcement.createdAt) > lastCleared
              const isFromOtherUser = announcement.author?.user?.id !== user.id
              return isNew && isFromOtherUser
            }) || []
            if (newAnnouncements.length > 0) {
              hasNew = true
              clubUnreadCount += newAnnouncements.length
            }
          }

          const calendarResponse = await fetch(`/api/calendar?clubId=${clubId}`)
          if (calendarResponse.ok) {
            const calendarData = await calendarResponse.json()
            const events = calendarData.events || []
            const newEvents = events.filter((event: any) => {
              const isNew = new Date(event.createdAt) > lastCleared
              const isFromOtherUser = event.creator?.user?.id !== user.id
              return isNew && isFromOtherUser
            })
            if (newEvents.length > 0) {
              hasNew = true
              clubUnreadCount += newEvents.length
            }
          }

          const financeResponse = await fetch(`/api/purchase-requests?clubId=${clubId}`)
          if (financeResponse.ok) {
            const financeData = await financeResponse.json()
            const purchaseRequests = financeData.purchaseRequests || []
            const newRequests = purchaseRequests.filter((item: any) => {
              const isNew = new Date(item.createdAt) > lastCleared
              const isFromOtherUser = item.requesterId !== membership.id
              return isNew && isFromOtherUser
            })
            if (newRequests.length > 0) {
              hasNew = true
              clubUnreadCount += newRequests.length
            }
          }

          const expensesResponse = await fetch(`/api/expenses?clubId=${clubId}`)
          if (expensesResponse.ok) {
            const expensesData = await expensesResponse.json()
            const expenses = expensesData.expenses || []
            const newExpenses = expenses.filter((item: any) => {
              const isNew = new Date(item.createdAt) > lastCleared
              const isFromOtherUser = item.addedById !== membership.id
              return isNew && isFromOtherUser
            })
            if (newExpenses.length > 0) {
              hasNew = true
              clubUnreadCount += newExpenses.length
            }
          }

          const testsResponse = await fetch(`/api/tests?clubId=${clubId}`)
          if (testsResponse.ok) {
            const testsData = await testsResponse.json()
            const newTests = testsData.tests?.filter((test: any) => {
              const isNew = new Date(test.createdAt) > lastCleared
              const isFromOtherUser = test.createdById !== membership.id
              return isNew && isFromOtherUser
            }) || []
            if (newTests.length > 0) {
              hasNew = true
              clubUnreadCount += newTests.length
            }
          }

          notifications[clubId] = hasNew
          totalUnreadItems += clubUnreadCount
        } catch (error) {
          console.error(`Failed to check notifications for club ${clubId}:`, error)
        }
      }

      setClubNotifications(notifications)
      setTotalUnreadCount(totalUnreadItems)
    }

    checkForNewContent()
    const interval = setInterval(checkForNewContent, 30000)
    return () => clearInterval(interval)
  }, [memberships, user.id])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 grid-pattern">
      <AppHeader user={user} />

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 md:mb-12">
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-tight">
            Your <span className="text-teamy-primary dark:text-teamy-accent">Clubs</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-2">
            Manage your teams, events, and schedules
          </p>
        </div>

        {memberships.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardHeader className="text-center py-10 md:py-12 px-4">
              <div className="inline-flex p-4 rounded-2xl bg-teamy-primary/10 dark:bg-teamy-accent/10 mx-auto mb-4">
                <Users className="h-10 w-10 md:h-12 md:w-12 text-teamy-primary dark:text-teamy-accent" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl mb-3">No Clubs Yet</CardTitle>
              <CardDescription className="text-base md:text-lg">
                Create your first club or join an existing one to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row justify-center gap-4 pb-10 md:pb-12 px-4">
              <Button 
                onClick={() => setJoinOpen(true)} 
                size="lg" 
                className="w-full sm:w-auto"
              >
                Join Club
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCreateOpen(true)} 
                size="lg" 
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Club
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
              <Button 
                onClick={() => setJoinOpen(true)} 
                size="lg" 
                className="w-full sm:w-auto"
              >
                Join Club
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setCreateOpen(true)} 
                size="lg" 
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Club
              </Button>
            </div>

            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {memberships.map((membership) => (
                <Link
                  key={membership.id}
                  href={`/club/${membership.club.id}`}
                  onClick={(e) => {
                    if (navigatingTo) {
                      e.preventDefault()
                      return
                    }
                    setNavigatingTo(membership.club.id)
                    clearClubNotification(membership.club.id)
                  }}
                  className="block"
                >
                <Card
                  className="cursor-pointer group relative overflow-hidden hover:shadow-card-hover hover:border-teamy-primary/30 dark:hover:border-teamy-accent/30 transition-all duration-300 hover:-translate-y-1 h-full"
                >
                  {clubNotifications[membership.club.id] && (
                    <div className="absolute right-4 top-4 z-10">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teamy-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-teamy-accent"></span>
                      </span>
                    </div>
                  )}
                  
                  <CardHeader className="pb-3 sm:pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg sm:text-xl mb-2 group-hover:text-teamy-primary dark:group-hover:text-teamy-accent transition-colors break-words">
                          {membership.club.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-teamy-primary/10 dark:bg-teamy-accent/10 text-teamy-primary dark:text-teamy-accent text-xs sm:text-sm font-semibold">
                            Division {membership.club.division}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {membership.team && (
                      <div className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
                        <Users className="h-4 w-4 flex-shrink-0" />
                        <span>Team: <span className="font-semibold text-foreground">{membership.team.name}</span></span>
                      </div>
                    )}
                    {membership.rosterAssignments && membership.rosterAssignments.length > 0 && (
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        <p className="font-medium mb-2 text-foreground">{membership.rosterAssignments.length} Event{membership.rosterAssignments.length !== 1 ? 's' : ''}:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {membership.rosterAssignments.map((assignment: any) => (
                            <Badge 
                              key={assignment.id} 
                              variant="secondary" 
                              className="text-[10px] sm:text-xs"
                            >
                              {assignment.event.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {membership.role === 'ADMIN' && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs uppercase font-semibold border-teamy-primary/30 bg-teamy-primary/10 text-teamy-primary dark:text-teamy-accent">
                          Admin
                        </Badge>
                      )}
                      {Array.isArray(membership.roles) && membership.roles.includes('COACH') && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs uppercase font-semibold">
                          Coach
                        </Badge>
                      )}
                      {Array.isArray(membership.roles) && membership.roles.includes('CAPTAIN') && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs uppercase font-semibold">
                          Captain
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
                </Link>
              ))}
            </div>
          </>
        )}

        <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} />
        <JoinClubDialog open={joinOpen} onOpenChange={setJoinOpen} />
      </main>
    </div>
  )
}

