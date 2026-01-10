'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { 
  BarChart3, 
  Users, 
  FileText, 
  CheckSquare,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  X,
  RefreshCw,
  Download,
  Target,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { PageLoading } from '@/components/ui/loading-spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'

interface StatsTabProps {
  clubId: string
  division: 'B' | 'C'
  initialStats?: {
    clubId: string
    division: 'B' | 'C'
    events: Event[]
    teams: { id: string; name: string }[]
    members: MemberStats[]
  } | null
}

interface MemberStats {
  membershipId: string
  userId: string
  name: string | null
  email: string
  image: string | null
  role: string
  team: { id: string; name: string } | null
  preferences: {
    id: string
    preferredEvents: string[]
    avoidEvents: string[]
    adminNotes: string | null
    strengths: string | null
    weaknesses: string | null
    experienceLevel: string | null
  } | null
  stats: {
    testScores: Array<{
      testId: string
      testName: string
      score: number | null
      maxScore: number | null
      percentage: number | null
      submittedAt: string | null
    }>
    avgTestScore: number | null
    attendanceCount: number
    attendanceRecords: Array<{
      attendanceId: string
      name: string
      date: string
      checkedInAt: string
    }>
    completedTodos: number
    totalTodos: number
    todoCompletionRate: number | null
  }
  assignments: Array<{
    eventId: string
    eventName: string
    eventSlug: string
  }>
}

interface Event {
  id: string
  name: string
  slug: string
  maxCompetitors: number
}

interface AIRoster {
  assignments: Array<{
    membershipId: string
    memberName: string
    events: string[]
    reasoning: string
  }>
  summary: string
  recommendations: string[]
}

export function StatsTab({ clubId, division, initialStats }: StatsTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(!initialStats)
  const [members, setMembers] = useState<MemberStats[]>(initialStats?.members || [])
  const [events, setEvents] = useState<Event[]>(initialStats?.events || [])
  const [teams, setTeams] = useState<{ id: string; name: string }[]>(initialStats?.teams || [])
  
  // Filter state
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // Edit state
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    preferredEvents: [] as string[],
    avoidEvents: [] as string[],
    adminNotes: '',
    strengths: '',
    weaknesses: '',
    experienceLevel: '',
  })
  const [saving, setSaving] = useState(false)
  
  // AI Roster state
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [generatingRoster, setGeneratingRoster] = useState(false)
  const [aiRoster, setAiRoster] = useState<AIRoster | null>(null)
  const [aiInstructions, setAiInstructions] = useState('')
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/stats?clubId=${clubId}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      setMembers(data.members || [])
      setEvents(data.events || [])
      setTeams(data.teams || [])
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      toast({
        title: 'Error',
        description: 'Failed to load stats',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [clubId, toast])

  useEffect(() => {
    if (!initialStats) {
      fetchStats()
    }
  }, [fetchStats, initialStats])

  const handleEditMember = (member: MemberStats) => {
    setEditingMember(member.membershipId)
    setEditForm({
      preferredEvents: member.preferences?.preferredEvents || [],
      avoidEvents: member.preferences?.avoidEvents || [],
      adminNotes: member.preferences?.adminNotes || '',
      strengths: member.preferences?.strengths || '',
      weaknesses: member.preferences?.weaknesses || '',
      experienceLevel: member.preferences?.experienceLevel || '',
    })
  }

  const handleSavePreferences = async () => {
    if (!editingMember) return
    setSaving(true)
    try {
      const response = await fetch('/api/member-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId: editingMember,
          ...editForm,
        }),
      })

      if (!response.ok) throw new Error('Failed to save preferences')

      toast({
        title: 'Saved',
        description: 'Member preferences updated',
      })

      setEditingMember(null)
      fetchStats()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save preferences',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateRoster = async () => {
    setGeneratingRoster(true)
    try {
      const response = await fetch('/api/ai/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          teamId: selectedTeam !== 'all' ? selectedTeam : undefined,
          additionalInstructions: aiInstructions || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate roster')
      }

      const data = await response.json()
      setAiRoster(data.roster)
      
      toast({
        title: 'Roster Generated',
        description: 'AI has created roster suggestions based on member data',
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate roster'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setGeneratingRoster(false)
    }
  }

  const toggleMemberExpanded = (membershipId: string) => {
    setExpandedMembers(prev => {
      const next = new Set(prev)
      if (next.has(membershipId)) {
        next.delete(membershipId)
      } else {
        next.add(membershipId)
      }
      return next
    })
  }

  // Filter and sort members
  const filteredMembers = members
    .filter(m => selectedTeam === 'all' || m.team?.id === selectedTeam)
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = (a.name || a.email).localeCompare(b.name || b.email)
          break
        case 'avgScore':
          comparison = (b.stats.avgTestScore || 0) - (a.stats.avgTestScore || 0)
          break
        case 'attendance':
          comparison = b.stats.attendanceCount - a.stats.attendanceCount
          break
        case 'todos':
          comparison = (b.stats.todoCompletionRate || 0) - (a.stats.todoCompletionRate || 0)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  if (loading) {
    return (
      <PageLoading
        title="Loading analytics"
        description="Calculating team statistics and insights..."
        variant="orbit"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Team Stats & Analytics
          </h2>
          <p className="text-muted-foreground">
            View comprehensive stats and manage member preferences
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 transition-transform duration-300 ${loading ? 'animate-spin' : 'hover:rotate-180'}`} />
            Refresh
          </Button>
          <Button onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            AI Roster
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {members.reduce((sum, m) => sum + m.stats.testScores.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Test Attempts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {members.reduce((sum, m) => sum + m.stats.attendanceCount, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">
                  {members.reduce((sum, m) => sum + m.stats.completedTodos, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Tasks Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs sm:text-sm whitespace-nowrap">Team:</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {teams.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs sm:text-sm whitespace-nowrap">Sort by:</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1 sm:w-[180px] h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="avgScore">Avg Test Score</SelectItem>
                  <SelectItem value="attendance">Attendance</SelectItem>
                  <SelectItem value="todos">Task Completion</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                className="h-9 w-9 p-0 flex-shrink-0"
              >
                {sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>Member Statistics</CardTitle>
          <CardDescription>
            Click on a member row to expand details and edit preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead>Preferred Events</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map(member => (
                  <Collapsible key={member.membershipId} asChild>
                    <>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleMemberExpanded(member.membershipId)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.image || undefined} />
                              <AvatarFallback>
                                {(member.name || member.email)[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{member.name || member.email}</p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{member.team?.name || '-'}</TableCell>
                        <TableCell className="text-right">
                          {member.stats.avgTestScore !== null 
                            ? `${member.stats.avgTestScore.toFixed(1)}%` 
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">{member.stats.attendanceCount}</TableCell>
                        <TableCell className="text-right">
                          {member.stats.totalTodos > 0 
                            ? `${member.stats.completedTodos}/${member.stats.totalTodos}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(member.preferences?.preferredEvents || []).slice(0, 3).map(e => (
                              <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                            ))}
                            {(member.preferences?.preferredEvents || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(member.preferences?.preferredEvents || []).length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditMember(member)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedMembers.has(member.membershipId) && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="p-4 space-y-4">
                              {/* Test Scores */}
                              <div>
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  Test Scores
                                </h4>
                                {member.stats.testScores.length > 0 ? (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {member.stats.testScores.map(test => (
                                      <div key={test.testId} className="p-2 bg-background rounded border">
                                        <p className="text-sm font-medium truncate">{test.testName}</p>
                                        <p className="text-lg font-bold">
                                          {test.percentage !== null ? `${test.percentage.toFixed(1)}%` : '-'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {test.score}/{test.maxScore}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No test attempts</p>
                                )}
                              </div>

                              {/* Preferences */}
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold mb-2">Preferences & Notes</h4>
                                  <div className="space-y-2 text-sm">
                                    {member.preferences?.experienceLevel && (
                                      <p><strong>Experience:</strong> {member.preferences.experienceLevel}</p>
                                    )}
                                    {member.preferences?.strengths && (
                                      <p><strong>Strengths:</strong> {member.preferences.strengths}</p>
                                    )}
                                    {member.preferences?.weaknesses && (
                                      <p><strong>Weaknesses:</strong> {member.preferences.weaknesses}</p>
                                    )}
                                    {member.preferences?.adminNotes && (
                                      <p><strong>Notes:</strong> {member.preferences.adminNotes}</p>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">Current Assignments</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {member.assignments.length > 0 ? (
                                      member.assignments.map(a => (
                                        <Badge key={a.eventId} variant="default">{a.eventName}</Badge>
                                      ))
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No current assignments</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Edit Member Preferences Dialog */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member Preferences</DialogTitle>
            <DialogDescription>
              Update preferences and notes for this team member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Experience Level</Label>
                <Select
                  value={editForm.experienceLevel || 'none'}
                  onValueChange={(v) => setEditForm({ ...editForm, experienceLevel: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="BEGINNER">Beginner</SelectItem>
                    <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                    <SelectItem value="ADVANCED">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preferred Events</Label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded p-3">
                {events.map(event => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`pref-${event.slug}`}
                      checked={editForm.preferredEvents.includes(event.slug)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditForm({
                            ...editForm,
                            preferredEvents: [...editForm.preferredEvents, event.slug],
                            avoidEvents: editForm.avoidEvents.filter(e => e !== event.slug),
                          })
                        } else {
                          setEditForm({
                            ...editForm,
                            preferredEvents: editForm.preferredEvents.filter(e => e !== event.slug),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`pref-${event.slug}`} className="text-sm cursor-pointer">
                      {event.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Events to Avoid</Label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded p-3">
                {events.map(event => (
                  <div key={event.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`avoid-${event.slug}`}
                      checked={editForm.avoidEvents.includes(event.slug)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditForm({
                            ...editForm,
                            avoidEvents: [...editForm.avoidEvents, event.slug],
                            preferredEvents: editForm.preferredEvents.filter(e => e !== event.slug),
                          })
                        } else {
                          setEditForm({
                            ...editForm,
                            avoidEvents: editForm.avoidEvents.filter(e => e !== event.slug),
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`avoid-${event.slug}`} className="text-sm cursor-pointer">
                      {event.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strengths">Strengths</Label>
              <Textarea
                id="strengths"
                placeholder="E.g., Strong in physics, good at building..."
                value={editForm.strengths}
                onChange={(e) => setEditForm({ ...editForm, strengths: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weaknesses">Areas for Improvement</Label>
              <Textarea
                id="weaknesses"
                placeholder="E.g., Needs practice with microscopy..."
                value={editForm.weaknesses}
                onChange={(e) => setEditForm({ ...editForm, weaknesses: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminNotes">Admin Notes</Label>
              <Textarea
                id="adminNotes"
                placeholder="Private notes about this member..."
                value={editForm.adminNotes}
                onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreferences} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Roster Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Roster Generator
            </DialogTitle>
            <DialogDescription>
              Use AI to generate optimal roster assignments based on member preferences, test scores, and attendance
            </DialogDescription>
          </DialogHeader>

          {!aiRoster ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Generate roster for:</Label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {teams.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-instructions">Additional Instructions (Optional)</Label>
                <Textarea
                  id="ai-instructions"
                  placeholder="E.g., Prioritize seniors for trial events, ensure each member has 2-3 events..."
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Data included in analysis:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Member preferences (preferred & avoided events)</li>
                  <li>• Test scores and performance history</li>
                  <li>• Attendance records</li>
                  <li>• Task completion rates</li>
                  <li>• Admin notes and assessments</li>
                  <li>• Current roster assignments</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* AI Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{aiRoster.summary}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Suggested Assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aiRoster.assignments.map((assignment, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{assignment.memberName}</span>
                          <div className="flex gap-1">
                            {assignment.events.map(e => (
                              <Badge key={e} variant="default">{e}</Badge>
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{assignment.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {aiRoster.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {aiRoster.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            {aiRoster ? (
              <>
                <Button variant="outline" onClick={() => setAiRoster(null)}>
                  Generate New
                </Button>
                <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
                  Close
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateRoster} disabled={generatingRoster}>
                  {generatingRoster ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Roster
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

