'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Send,
  Loader2,
  RefreshCw,
  Users,
  Filter,
  Eye,
  Mail,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface FilteredUser {
  id: string
  email: string
  name: string | null
  image: string | null
  createdAt: string
  isClubAdmin: boolean
  isTournamentDirector: boolean
  isEventSupervisor: boolean
  clubCount: number
  lastActive: string | null
}

interface FilterStats {
  totalUsers: number
  matchingUsers: number
  users: FilteredUser[]
}

export function EmailManager() {
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [filterStats, setFilterStats] = useState<FilterStats | null>(null)
  
  // Filter states
  const [minMemberDays, setMinMemberDays] = useState<string>('')
  const [maxMemberDays, setMaxMemberDays] = useState<string>('')
  const [minClubs, setMinClubs] = useState<string>('')
  const [isClubAdmin, setIsClubAdmin] = useState<boolean | null>(null)
  const [isTournamentDirector, setIsTournamentDirector] = useState<boolean | null>(null)
  const [isEventSupervisor, setIsEventSupervisor] = useState<boolean | null>(null)
  
  // Email states
  const [subject, setSubject] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)

  const fetchFilteredUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (minMemberDays) params.append('minMemberDays', minMemberDays)
      if (maxMemberDays) params.append('maxMemberDays', maxMemberDays)
      if (minClubs) params.append('minClubs', minClubs)
      if (isClubAdmin !== null) params.append('isClubAdmin', String(isClubAdmin))
      if (isTournamentDirector !== null) params.append('isTournamentDirector', String(isTournamentDirector))
      if (isEventSupervisor !== null) params.append('isEventSupervisor', String(isEventSupervisor))

      const response = await fetch(`/api/dev/users?${params.toString()}`)
      const data = await response.json()
      setFilterStats(data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }, [minMemberDays, maxMemberDays, minClubs, isClubAdmin, isTournamentDirector, isEventSupervisor])

  useEffect(() => {
    fetchFilteredUsers()
  }, [fetchFilteredUsers])

  const handleSendEmail = async () => {
    if (!subject || !htmlContent || !filterStats?.matchingUsers) {
      return
    }

    setSending(true)
    setSendResult(null)
    
    try {
      const params = new URLSearchParams()
      if (minMemberDays) params.append('minMemberDays', minMemberDays)
      if (maxMemberDays) params.append('maxMemberDays', maxMemberDays)
      if (minClubs) params.append('minClubs', minClubs)
      if (isClubAdmin !== null) params.append('isClubAdmin', String(isClubAdmin))
      if (isTournamentDirector !== null) params.append('isTournamentDirector', String(isTournamentDirector))
      if (isEventSupervisor !== null) params.append('isEventSupervisor', String(isEventSupervisor))

      const response = await fetch('/api/dev/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          htmlContent,
          filters: Object.fromEntries(params.entries()),
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setSendResult({ success: true, message: 'Emails sent successfully!', count: data.sent })
        setSubject('')
        setHtmlContent('')
      } else {
        setSendResult({ success: false, message: data.error || 'Failed to send emails' })
      }
    } catch (error) {
      console.error('Error sending emails:', error)
      setSendResult({ success: false, message: 'Failed to send emails' })
    } finally {
      setSending(false)
      setConfirmOpen(false)
    }
  }

  const clearFilters = () => {
    setMinMemberDays('')
    setMaxMemberDays('')
    setMinClubs('')
    setIsClubAdmin(null)
    setIsTournamentDirector(null)
    setIsEventSupervisor(null)
  }

  const getFilterSummary = () => {
    const parts: string[] = []
    if (minMemberDays) parts.push(`≥${minMemberDays} days old`)
    if (maxMemberDays) parts.push(`≤${maxMemberDays} days old`)
    if (minClubs) parts.push(`≥${minClubs} clubs`)
    if (isClubAdmin === true) parts.push('Club Admins')
    if (isClubAdmin === false) parts.push('Not Club Admins')
    if (isTournamentDirector === true) parts.push('Tournament Directors')
    if (isTournamentDirector === false) parts.push('Not Tournament Directors')
    if (isEventSupervisor === true) parts.push('Event Supervisors')
    if (isEventSupervisor === false) parts.push('Not Event Supervisors')
    return parts.length > 0 ? parts.join(', ') : 'All users'
  }

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                User Filters
              </CardTitle>
              <CardDescription>
                Filter users to target your email campaign
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
              <Button variant="outline" size="sm" onClick={fetchFilteredUsers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Member Duration */}
            <div className="space-y-2">
              <Label>Member for (days)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minMemberDays}
                  onChange={(e) => setMinMemberDays(e.target.value)}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxMemberDays}
                  onChange={(e) => setMaxMemberDays(e.target.value)}
                  min="0"
                />
              </div>
            </div>

            {/* Minimum Clubs */}
            <div className="space-y-2">
              <Label>Minimum Clubs Joined</Label>
              <Input
                type="number"
                placeholder="e.g., 1"
                value={minClubs}
                onChange={(e) => setMinClubs(e.target.value)}
                min="0"
              />
            </div>

            {/* Role Filters */}
            <div className="space-y-2">
              <Label>Club Admin Status</Label>
              <Select 
                value={isClubAdmin === null ? 'any' : String(isClubAdmin)} 
                onValueChange={(v) => setIsClubAdmin(v === 'any' ? null : v === 'true')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="true">Is Club Admin</SelectItem>
                  <SelectItem value="false">Not Club Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tournament Director Status</Label>
              <Select 
                value={isTournamentDirector === null ? 'any' : String(isTournamentDirector)} 
                onValueChange={(v) => setIsTournamentDirector(v === 'any' ? null : v === 'true')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="true">Is Tournament Director</SelectItem>
                  <SelectItem value="false">Not Tournament Director</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Event Supervisor Status</Label>
              <Select 
                value={isEventSupervisor === null ? 'any' : String(isEventSupervisor)} 
                onValueChange={(v) => setIsEventSupervisor(v === 'any' ? null : v === 'true')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="true">Is Event Supervisor</SelectItem>
                  <SelectItem value="false">Not Event Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter Results Summary */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {loading ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : (
                  <Users className="h-5 w-5 text-muted-foreground" />
                )}
                {!loading && (
                  <span className="font-medium">
                    {`${filterStats?.matchingUsers || 0} users match your filters`}
                  </span>
                )}
                {filterStats && (
                  <span className="text-muted-foreground">
                    (out of {filterStats.totalUsers} total)
                  </span>
                )}
              </div>
              <Badge variant="outline">{getFilterSummary()}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matching Users Preview */}
      {filterStats && filterStats.users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Matching Users Preview</CardTitle>
            <CardDescription>Showing first 50 matching users</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {filterStats.users.slice(0, 50).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={user.image || ''} />
                        <AvatarFallback className="text-xs">
                          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium">{user.name || 'No name'}</span>
                        <span className="text-muted-foreground text-xs truncate">{user.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.isClubAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                      {user.isTournamentDirector && <Badge variant="outline" className="text-xs">TD</Badge>}
                      {user.isEventSupervisor && <Badge variant="outline" className="text-xs">ES</Badge>}
                      <span className="text-xs text-muted-foreground">{user.clubCount} clubs</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Email Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Email
          </CardTitle>
          <CardDescription>
            Write your email using HTML. Supports full HTML formatting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="edit" className="space-y-4">
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Email Content (HTML) *</Label>
                <textarea
                  id="content"
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder={`<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1f2937;">Hello!</h1>
  <p style="color: #374151; line-height: 1.6;">
    Your email content here...
  </p>
</div>`}
                  className="w-full min-h-[300px] p-3 border rounded-lg bg-background resize-y font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!subject || !htmlContent || !filterStats?.matchingUsers || sending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to {filterStats?.matchingUsers || 0} Users
                </Button>
                <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!htmlContent}>
                  <Eye className="h-4 w-4 mr-2" />
                  Full Preview
                </Button>
              </div>

              {sendResult && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  sendResult.success 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  {sendResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={sendResult.success ? 'text-green-600' : 'text-red-600'}>
                    {sendResult.message}
                    {sendResult.count !== undefined && ` (${sendResult.count} emails sent)`}
                  </span>
                </div>
              )}
            </TabsContent>

            <TabsContent value="preview">
              <div className="border rounded-lg p-4 bg-card min-h-[300px]">
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-muted-foreground">Subject:</p>
                  <p className="font-semibold">{subject || '(No subject)'}</p>
                </div>
                <div 
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: htmlContent || '<p class="text-muted-foreground">(No content)</p>' }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Full Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              This is how your email will appear to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-6 bg-card">
            <div className="mb-4 pb-4 border-b">
              <p className="text-sm text-muted-foreground">From: Teamy &lt;no-reply@teamy.site&gt;</p>
              <p className="text-sm text-muted-foreground">To: {filterStats?.matchingUsers || 0} recipients</p>
              <p className="font-semibold mt-2">Subject: {subject}</p>
            </div>
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Send
            </DialogTitle>
            <DialogDescription className="pt-2">
              You are about to send an email to <strong>{filterStats?.matchingUsers || 0} users</strong>.
              <br /><br />
              <strong>Subject:</strong> {subject}
              <br /><br />
              <strong>Filters:</strong> {getFilterSummary()}
              <br /><br />
              This action cannot be undone. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Emails
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

