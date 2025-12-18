'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  RefreshCw,
  Users,
  TrendingUp,
  Calendar,
  Trophy,
  Building2,
  Activity,
  UserPlus,
  Clock,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns'

interface AnalyticsData {
  overview: {
    totalUsers: number
    totalClubs: number
    totalTournaments: number
    totalMemberships: number
    activeUsersLast7Days: number
    activeUsersLast30Days: number
  }
  userGrowth: {
    date: string
    count: number
    cumulative: number
  }[]
  clubGrowth: {
    date: string
    count: number
    cumulative: number
  }[]
  topUsers: {
    id: string
    name: string | null
    email: string
    clubCount: number
    createdAt: string
    lastActive: string | null
  }[]
  recentSignups: {
    id: string
    name: string | null
    email: string
    createdAt: string
  }[]
  roleDistribution: {
    clubAdmins: number
    tournamentDirectors: number
    eventSupervisors: number
    regularMembers: number
  }
}

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/dev/analytics?range=${timeRange}`)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.overview.totalUsers.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.overview.activeUsersLast7Days || 0} active in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clubs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.overview.totalClubs.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.overview.totalMemberships || 0} total memberships
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tournaments</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.overview.totalTournaments.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Approved tournaments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users (30d)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.overview.activeUsersLast30Days.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.overview.totalUsers ? Math.round((data.overview.activeUsersLast30Days / data.overview.totalUsers) * 100) : 0}% of total users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Role Distribution
          </CardTitle>
          <CardDescription>Breakdown of users by role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 border rounded-lg text-center">
              <div className="text-3xl font-bold text-blue-600">{data?.roleDistribution.clubAdmins || 0}</div>
              <p className="text-sm text-muted-foreground mt-1">Club Admins</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <div className="text-3xl font-bold text-purple-600">{data?.roleDistribution.tournamentDirectors || 0}</div>
              <p className="text-sm text-muted-foreground mt-1">Tournament Directors</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <div className="text-3xl font-bold text-green-600">{data?.roleDistribution.eventSupervisors || 0}</div>
              <p className="text-sm text-muted-foreground mt-1">Event Supervisors</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <div className="text-3xl font-bold text-slate-600">{data?.roleDistribution.regularMembers || 0}</div>
              <p className="text-sm text-muted-foreground mt-1">Regular Members</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Growth Chart */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              User Growth
            </CardTitle>
            <CardDescription>New user signups over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {data?.userGrowth && data.userGrowth.length > 0 ? (
                <div className="space-y-2">
                  {data.userGrowth.map((item, idx) => (
                    <div key={item.date} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{format(new Date(item.date), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          +{item.count}
                        </Badge>
                        <span className="text-sm text-muted-foreground w-20 text-right">
                          Total: {item.cumulative}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No growth data available
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Club Growth
            </CardTitle>
            <CardDescription>New clubs created over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {data?.clubGrowth && data.clubGrowth.length > 0 ? (
                <div className="space-y-2">
                  {data.clubGrowth.map((item, idx) => (
                    <div key={item.date} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{format(new Date(item.date), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                          +{item.count}
                        </Badge>
                        <span className="text-sm text-muted-foreground w-20 text-right">
                          Total: {item.cumulative}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No growth data available
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Signups & Top Users */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Recent Signups
            </CardTitle>
            <CardDescription>Latest users to join</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {data?.recentSignups && data.recentSignups.length > 0 ? (
                <div className="space-y-2">
                  {data.recentSignups.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{user.name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(user.createdAt), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(user.createdAt), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent signups
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Most Active Users
            </CardTitle>
            <CardDescription>Users with the most club memberships</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {data?.topUsers && data.topUsers.length > 0 ? (
                <div className="space-y-2">
                  {data.topUsers.map((user, idx) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">{user.name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{user.clubCount} clubs</Badge>
                        {user.lastActive && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Active {format(new Date(user.lastActive), 'MMM d')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No user data available
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

