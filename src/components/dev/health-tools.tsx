'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { JSX } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  RefreshCw,
  Search,
  Filter,
  Activity,
  Users,
  Server,
  Clock,
  AlertCircle,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Trash2,
  Shield,
  Plus,
  Mail,
} from 'lucide-react'
import { format } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface LogEntry {
  id: string
  timestamp: string
  action?: string
  description?: string
  message?: string
  errorType?: string
  method?: string
  route?: string
  statusCode?: number
  executionTime?: number
  logType?: string
  severity?: string
  ipAddress?: string
  userAgent?: string
  error?: string
  user?: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  } | null
  metadata?: any
  stack?: string
  resolved?: boolean
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// Helper function to highlight search terms in text
const highlightText = (text: string | null | undefined, searchQuery: string): string | (string | JSX.Element)[] => {
  if (!text || !searchQuery) return text || ''
  
  const query = searchQuery.trim()
  if (!query) return text
  
  // Escape special regex characters
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = text.split(regex)
  
  return parts.map((part, index) => 
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-900 text-foreground px-0.5 rounded">
        {part}
      </mark>
    ) : part
  )
}

export function HealthTools() {
  // State for all logs (combined)
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [apiLogs, setApiLogs] = useState<LogEntry[]>([])
  const [errorLogs, setErrorLogs] = useState<LogEntry[]>([])
  const [activityLogs, setActivityLogs] = useState<LogEntry[]>([])
  
  // Pagination
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  // Loading states
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'api' | 'errors' | 'users' | 'access'>(() => {
    // Load saved tab from localStorage, default to 'all'
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('dev-tools-active-tab')
      if (savedTab && ['all', 'api', 'errors', 'users', 'access'].includes(savedTab)) {
        return savedTab as 'all' | 'api' | 'errors' | 'users' | 'access'
      }
    }
    return 'all'
  })

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLogTypes, setSelectedLogTypes] = useState<string[]>([])
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([])
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [slowOnly, setSlowOnly] = useState(false)
  const [apiUsageOnly, setApiUsageOnly] = useState(false)
  const [resolvedFilter, setResolvedFilter] = useState<'all' | 'resolved' | 'unresolved'>('all')
  const [logTypeSelectValue, setLogTypeSelectValue] = useState<string | undefined>(undefined)
  const [severitySelectValue, setSeveritySelectValue] = useState<string | undefined>(undefined)
  const [selectKey, setSelectKey] = useState(0)

  // User search
  const [users, setUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userLoading, setUserLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<any>(null)

  // Email whitelist
  const [whitelistEmails, setWhitelistEmails] = useState<Array<{ email: string; name: string | null; image: string | null }>>([])
  const [newEmail, setNewEmail] = useState('')
  const [whitelistLoading, setWhitelistLoading] = useState(false)
  const [whitelistSaving, setWhitelistSaving] = useState(false)


  // Scroll detection for pausing auto-refresh
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scrollAreaRefs = useRef<Map<string, HTMLElement>>(new Map())
  const scrollListenersRef = useRef<Map<string, HTMLElement>>(new Map())
  
  // Callback ref to store ScrollArea root elements and find viewport
  const setScrollAreaRef = useCallback((tab: string) => (element: HTMLElement | null) => {
    if (element) {
      // Use setTimeout to ensure viewport is rendered
      setTimeout(() => {
        const viewport = element.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
        if (viewport) {
          scrollAreaRefs.current.set(tab, viewport)
        }
      }, 0)
    } else {
      scrollAreaRefs.current.delete(tab)
    }
  }, [])

  // Fetch logs based on current filters (with loading state)
  const fetchLogs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const params = new URLSearchParams()
      
      if (selectedLogTypes.length > 0) {
        selectedLogTypes.forEach(type => params.append('logType', type))
      }
      if (selectedSeverities.length > 0) {
        selectedSeverities.forEach(sev => params.append('severity', sev))
      }
      if (selectedRoutes.length > 0) {
        params.append('route', selectedRoutes[0])
      }
      if (selectedUserIds.length > 0) {
        params.append('userId', selectedUserIds[0])
      }
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (apiUsageOnly) params.append('logType', 'API_USAGE')
      
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())

      const [activityRes, apiRes, errorRes] = await Promise.all([
        fetch(`/api/dev/logs?${params.toString()}`),
        fetch(`/api/dev/api-logs?${params.toString()}${errorsOnly ? '&errorsOnly=true' : ''}${slowOnly ? '&slowOnly=true' : ''}`),
        fetch(`/api/dev/error-logs?${params.toString()}${resolvedFilter !== 'all' ? `&resolved=${resolvedFilter === 'resolved'}` : ''}`),
      ])

      const [activityData, apiData, errorData] = await Promise.all([
        activityRes.json(),
        apiRes.json(),
        errorRes.json(),
      ])

      setActivityLogs(activityData.logs || [])
      setApiLogs(apiData.logs || [])
      setErrorLogs(errorData.logs || [])

      // Combine all logs
      const combined = [
        ...(activityData.logs || []).map((log: any) => ({ ...log, source: 'activity' })),
        ...(apiData.logs || []).map((log: any) => ({ ...log, source: 'api' })),
        ...(errorData.logs || []).map((log: any) => ({ ...log, source: 'error' })),
      ].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setAllLogs(combined)

      // Apply search filter
      if (searchQuery) {
        const filtered = combined.filter(log => 
          log.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.route?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        setAllLogs(filtered)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [
    selectedLogTypes,
    selectedSeverities,
    selectedRoutes,
    selectedUserIds,
    startDate,
    endDate,
    errorsOnly,
    slowOnly,
    apiUsageOnly,
    resolvedFilter,
    searchQuery,
    pagination.page,
    pagination.limit,
  ])

  // Fetch users
  const fetchUsers = useCallback(async () => {
    if (activeTab !== 'users') return
    
    setUserLoading(true)
    try {
      const params = new URLSearchParams()
      if (userSearch) params.append('search', userSearch)
      params.append('limit', '50')

      const response = await fetch(`/api/dev/users?${params.toString()}`)
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setUserLoading(false)
    }
  }, [userSearch, activeTab])

  // Fetch email whitelist
  const fetchWhitelist = useCallback(async () => {
    if (activeTab !== 'access') return
    
    setWhitelistLoading(true)
    try {
      const response = await fetch('/api/dev/email-whitelist')
      const data = await response.json()
      if (data.emails) {
        setWhitelistEmails(data.emails)
      }
    } catch (error) {
      console.error('Failed to fetch email whitelist:', error)
    } finally {
      setWhitelistLoading(false)
    }
  }, [activeTab])

  // Internal fetch function for use after saving (doesn't check activeTab)
  const refetchWhitelist = useCallback(async () => {
    try {
      const response = await fetch('/api/dev/email-whitelist')
      const data = await response.json()
      if (data.emails) {
        setWhitelistEmails(data.emails)
      }
    } catch (error) {
      console.error('Failed to refetch email whitelist:', error)
    }
  }, [])

  // Save email whitelist
  const saveWhitelist = useCallback(async (emails: string[]) => {
    setWhitelistSaving(true)
    try {
      const response = await fetch('/api/dev/email-whitelist', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        // Refetch to get updated user info
        await refetchWhitelist()
        return true
      } else {
        alert(data.error || 'Failed to save whitelist')
        return false
      }
    } catch (error) {
      console.error('Failed to save email whitelist:', error)
      alert('Failed to save whitelist')
      return false
    } finally {
      setWhitelistSaving(false)
    }
  }, [refetchWhitelist])

  // Add email to whitelist
  const handleAddEmail = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address')
      return
    }

    if (whitelistEmails.some(e => e.email.toLowerCase() === email)) {
      alert('Email already in whitelist')
      setNewEmail('')
      return
    }

    const emailList = whitelistEmails.map(e => e.email)
    emailList.push(email)
    const success = await saveWhitelist(emailList)
    if (success) {
      setNewEmail('')
    }
  }

  // Remove email from whitelist
  const handleRemoveEmail = async (emailToRemove: string) => {
    if (whitelistEmails.length <= 1) {
      alert('Cannot remove all emails from whitelist')
      return
    }

    const emailList = whitelistEmails
      .filter((item) => item.email !== emailToRemove)
      .map(e => e.email)
    await saveWhitelist(emailList)
  }


  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dev-tools-active-tab', activeTab)
    }
  }, [activeTab])

  // Initial load
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'access') {
      fetchWhitelist()
    } else {
      fetchLogs()
    }
  }, [activeTab, fetchUsers, fetchWhitelist, fetchLogs])

  // Fetch when filters change (debounced search)
  useEffect(() => {
    if (activeTab === 'users') {
      const timer = setTimeout(() => {
        fetchUsers()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [userSearch, activeTab, fetchUsers])

  // Fetch logs when filters change
  useEffect(() => {
    if (activeTab !== 'users') {
      const timer = setTimeout(() => {
        fetchLogs()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [
    selectedLogTypes,
    selectedSeverities,
    selectedRoutes,
    selectedUserIds,
    startDate,
    endDate,
    errorsOnly,
    slowOnly,
    apiUsageOnly,
    resolvedFilter,
    activeTab,
  ])
  
  // Search query changes trigger immediate fetch
  useEffect(() => {
    if (activeTab !== 'users' && searchQuery !== undefined) {
      fetchLogs()
    }
  }, [searchQuery])

  // Handle scroll detection to pause auto-refresh
  useEffect(() => {
    if (activeTab === 'users') return

    const handleScroll = () => {
      setIsScrolling(true)
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      // Set scrolling to false after 500ms of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 500)
    }

    // Get viewport from stored refs
    const viewport = scrollAreaRefs.current.get(activeTab)
    
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll, { passive: true })
      scrollListenersRef.current.set(activeTab, viewport)
    }
    
    // Retry after a short delay if viewport not found yet (for initial render)
    const retryTimeout = !viewport ? setTimeout(() => {
      const foundViewport = scrollAreaRefs.current.get(activeTab)
      if (foundViewport && !scrollListenersRef.current.has(activeTab)) {
        foundViewport.addEventListener('scroll', handleScroll, { passive: true })
        scrollListenersRef.current.set(activeTab, foundViewport)
      }
    }, 300) : null
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout)
      const listenerViewport = scrollListenersRef.current.get(activeTab)
      if (listenerViewport) {
        listenerViewport.removeEventListener('scroll', handleScroll)
        scrollListenersRef.current.delete(activeTab)
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [activeTab])

  // Auto-refresh logs every 1 second when on logs tabs (silent, no loading indicator)
  // Pauses when user is scrolling
  useEffect(() => {
    if (activeTab === 'users' || isScrolling) return

    // Set up interval to refresh every 1 second (silent refresh)
    const interval = setInterval(() => {
      fetchLogs(false) // false = don't show loading indicator
    }, 1000) // 1 second

    // Cleanup interval on unmount or tab change
    return () => clearInterval(interval)
  }, [activeTab, fetchLogs, isScrolling])

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedLogTypes([])
    setSelectedSeverities([])
    setSelectedRoutes([])
    setSelectedUserIds([])
    setStartDate('')
    setEndDate('')
    setErrorsOnly(false)
    setSlowOnly(false)
    setApiUsageOnly(false)
    setResolvedFilter('all')
    setLogTypeSelectValue(undefined)
    setSeveritySelectValue(undefined)
    setSelectKey(prev => prev + 1) // Force remount of Select components
  }

  // Get logs to display based on active tab
  const getDisplayLogs = () => {
    switch (activeTab) {
      case 'api':
        return apiLogs
      case 'errors':
        return errorLogs
      default:
        return allLogs
    }
  }

  // Get severity badge variant
  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'ERROR':
        return <Badge variant="destructive">{severity}</Badge>
      case 'WARNING':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">{severity}</Badge>
      case 'INFO':
        return <Badge variant="secondary">{severity}</Badge>
      case 'DEBUG':
        return <Badge variant="outline">{severity}</Badge>
      default:
        return null
    }
  }

  // Get status badge for API logs
  const getStatusBadge = (statusCode?: number) => {
    if (!statusCode) return null
    if (statusCode >= 500) {
      return <Badge variant="destructive">{statusCode}</Badge>
    }
    if (statusCode >= 400) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">{statusCode}</Badge>
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-700">{statusCode}</Badge>
  }

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      const response = await fetch(`/api/dev/users/${userToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Refresh users list
        fetchUsers()
        // Refresh logs to show the deletion activity
        fetchLogs()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(errorData.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user')
    } finally {
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }

  // Handle export user
  const handleExportUser = (user: any) => {
    // Helper function to escape CSV fields
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // User Basic Information
    const userSection = [
      ['User Information'],
      ['User ID', user.id],
      ['Name', user.name || 'No name'],
      ['Email', user.email],
      ['Created At', new Date(user.createdAt).toLocaleString()],
      [''],
      ['Memberships'],
      ['Club Name', 'Club ID', 'Team Name', 'Team ID', 'Role', 'Division', 'Joined At']
    ]

    // Add team memberships
    const membershipRows = (user.memberships || []).map((m: any) => [
      escapeCSV(m.club?.name || 'N/A'),
      escapeCSV(m.club?.id || 'N/A'),
      escapeCSV(m.team?.name || 'N/A'),
      escapeCSV(m.team?.id || 'N/A'),
      escapeCSV(m.role || 'N/A'),
      escapeCSV(m.club?.division || 'None'),
      escapeCSV(new Date(m.createdAt).toLocaleString()),
    ])

    if (membershipRows.length === 0) {
      membershipRows.push(['No teams', '', '', '', '', '', ''])
    }

    // Combine all sections
    const csvContent = [
      ...userSection.map((row) => row.map(escapeCSV).join(',')),
      ...membershipRows.map((row: string[]) => row.join(',')),
    ].join('\n')

    // Add BOM for Excel compatibility with special characters
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = (user.name || user.email || 'user').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    link.download = `${safeName}-${user.id.substring(0, 8)}-export-${new Date().toISOString().split('T')[0]}.csv`
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            All Logs
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            API Activity
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Errors
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Access Control
          </TabsTrigger>
        </TabsList>

        {/* All Logs Tab */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Logs & Activity</CardTitle>
                  <CardDescription>
                    Combined view of activity logs, API calls, and errors
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="space-y-4 p-4 border rounded-xl bg-muted/30 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Search</Label>
                    <div className="relative">
                      <Search 
                        className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" 
                        style={{ 
                          top: '50%',
                          transform: 'translateY(-50%)',
                          willChange: 'transform'
                        }} 
                      />
                      <Input
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Log Types</Label>
                    <Select 
                      key={`log-type-${selectKey}`}
                      value={logTypeSelectValue}
                      onValueChange={(v) => {
                        setLogTypeSelectValue(v)
                        if (v && !selectedLogTypes.includes(v)) {
                          setSelectedLogTypes([...selectedLogTypes, v])
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER_ACTION">User Actions</SelectItem>
                        <SelectItem value="ADMIN_ACTION">Admin Actions</SelectItem>
                        <SelectItem value="SYSTEM_EVENT">System Events</SelectItem>
                        <SelectItem value="API_USAGE">API Usage</SelectItem>
                        <SelectItem value="ERROR">Errors</SelectItem>
                        <SelectItem value="WARNING">Warnings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Severity</Label>
                    <Select 
                      key={`severity-${selectKey}`}
                      value={severitySelectValue}
                      onValueChange={(v) => {
                        setSeveritySelectValue(v)
                        if (v && !selectedSeverities.includes(v)) {
                          setSelectedSeverities([...selectedSeverities, v])
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEBUG">Debug</SelectItem>
                        <SelectItem value="INFO">Info</SelectItem>
                        <SelectItem value="WARNING">Warning</SelectItem>
                        <SelectItem value="ERROR">Error</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        placeholder="Start"
                        className="text-sm [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:h-4"
                      />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        placeholder="End"
                        className="text-sm [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:h-4"
                      />
                    </div>
                  </div>
                </div>

                {/* Active Filters & Options Row */}
                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/50">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    {selectedLogTypes.map(type => (
                      <Badge 
                        key={type} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-secondary/80 transition-colors gap-1.5" 
                        onClick={() => setSelectedLogTypes(selectedLogTypes.filter(t => t !== type))}
                      >
                        <span className="text-xs">{type.replace('_', ' ')}</span>
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                    {selectedSeverities.map(sev => (
                      <Badge 
                        key={sev} 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-secondary/80 transition-colors gap-1.5" 
                        onClick={() => setSelectedSeverities(selectedSeverities.filter(s => s !== sev))}
                      >
                        <span className="text-xs">{sev}</span>
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                    {(selectedLogTypes.length > 0 || selectedSeverities.length > 0 || startDate || endDate || apiUsageOnly) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearFilters} 
                        className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3 mr-1.5" />
                        Clear All
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="api-only"
                      checked={apiUsageOnly}
                      onCheckedChange={(checked) => setApiUsageOnly(checked as boolean)}
                    />
                    <Label htmlFor="api-only" className="cursor-pointer text-sm font-normal">API Usage Only</Label>
                  </div>
                </div>
              </div>

              {/* Logs List */}
              <ScrollArea className="h-[600px]" ref={setScrollAreaRef('all')}>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : getDisplayLogs().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No logs found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getDisplayLogs().map((log) => (
                      <div
                        key={log.id}
                        className="p-4 border rounded-xl hover:bg-muted/50 transition-all duration-200 hover:shadow-md apple-hover"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {log.statusCode !== undefined && getStatusBadge(log.statusCode)}
                              {getSeverityBadge(log.severity)}
                              {log.logType && (
                                <Badge variant="outline">{log.logType.replace('_', ' ')}</Badge>
                              )}
                              {log.method && (
                                <Badge variant="outline">{log.method}</Badge>
                              )}
                              {log.route && (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {highlightText(log.route, searchQuery)}
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-sm mb-1">
                              {highlightText(log.description || log.message || log.errorType || `${log.method} ${log.route}`, searchQuery)}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {log.user && (
                                <div className="flex items-center gap-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={log.user.image || ''} />
                                    <AvatarFallback className="text-[8px]">
                                      {log.user.name?.charAt(0) || log.user.email.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>
                                    {log.user.name 
                                      ? (
                                        <>
                                          {highlightText(log.user.name, searchQuery)} ({highlightText(log.user.email, searchQuery)})
                                        </>
                                      )
                                      : highlightText(log.user.email, searchQuery)}
                                  </span>
                                </div>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                              </span>
                              {log.executionTime && (
                                <span>{log.executionTime}ms</span>
                              )}
                            </div>
                            {log.metadata && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer">
                                  View metadata
                                </summary>
                                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                            {log.stack && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer">
                                  View stack trace
                                </summary>
                                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                                  {log.stack}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Activity Tab */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Activity</CardTitle>
                  <CardDescription>
                    Track all API route usage, response times, and status codes
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 p-4 border rounded-xl bg-muted/30 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="errors-only"
                    checked={errorsOnly}
                    onCheckedChange={(checked) => setErrorsOnly(checked as boolean)}
                  />
                  <Label htmlFor="errors-only" className="cursor-pointer">Errors Only (4xx/5xx)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="slow-only"
                    checked={slowOnly}
                    onCheckedChange={(checked) => setSlowOnly(checked as boolean)}
                  />
                  <Label htmlFor="slow-only" className="cursor-pointer">Slow Responses (&gt;1s)</Label>
                </div>
              </div>

              <ScrollArea className="h-[600px]" ref={setScrollAreaRef('api')}>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : apiLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No API logs found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apiLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 border rounded-xl hover:bg-muted/50 transition-all duration-200 hover:shadow-md apple-hover"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {getStatusBadge(log.statusCode)}
                              <Badge variant="outline">{log.method}</Badge>
                              <Badge variant="outline" className="font-mono text-xs">
                                {highlightText(log.route, searchQuery)}
                              </Badge>
                              {log.executionTime && (
                                <Badge variant={log.executionTime > 1000 ? 'destructive' : 'secondary'}>
                                  {log.executionTime}ms
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {log.user && (
                                <div className="flex items-center gap-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={log.user.image || ''} />
                                    <AvatarFallback className="text-[8px]">
                                      {log.user.name?.charAt(0) || log.user.email.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>
                                    {log.user.name 
                                      ? (
                                        <>
                                          {highlightText(log.user.name, searchQuery)} ({highlightText(log.user.email, searchQuery)})
                                        </>
                                      )
                                      : highlightText(log.user.email, searchQuery)}
                                  </span>
                                </div>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                              </span>
                              {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                            </div>
                            {log.error && (
                              <div className="mt-2 text-sm text-destructive">
                                Error: {log.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Error Logs</CardTitle>
                  <CardDescription>
                    Backend errors, failed requests, and critical issues
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchLogs()} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 p-4 border rounded-xl bg-muted/30 backdrop-blur-sm">
                <Select value={resolvedFilter} onValueChange={(v: any) => setResolvedFilter(v)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Errors</SelectItem>
                    <SelectItem value="unresolved">Unresolved Only</SelectItem>
                    <SelectItem value="resolved">Resolved Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[600px]" ref={setScrollAreaRef('errors')}>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : errorLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No errors found
                  </div>
                ) : (
                  <div className="space-y-2">
                    {errorLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 border rounded-xl hover:bg-muted/50 transition-all duration-200 hover:shadow-md apple-hover"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {getSeverityBadge(log.severity)}
                              {log.errorType && (
                                <Badge variant="outline">{log.errorType}</Badge>
                              )}
                              {log.route && (
                                <Badge variant="outline" className="font-mono text-xs">
                                  {highlightText(log.route, searchQuery)}
                                </Badge>
                              )}
                              {log.resolved !== undefined && (
                                <Badge variant={log.resolved ? 'default' : 'destructive'}>
                                  {log.resolved ? 'Resolved' : 'Unresolved'}
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-sm mb-1">{highlightText(log.message, searchQuery)}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {log.user && (
                                <div className="flex items-center gap-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={log.user.image || ''} />
                                    <AvatarFallback className="text-[8px]">
                                      {log.user.name?.charAt(0) || log.user.email.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>
                                    {log.user.name 
                                      ? (
                                        <>
                                          {highlightText(log.user.name, searchQuery)} ({highlightText(log.user.email, searchQuery)})
                                        </>
                                      )
                                      : highlightText(log.user.email, searchQuery)}
                                  </span>
                                </div>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                              </span>
                            </div>
                            {log.stack && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer">
                                  View stack trace
                                </summary>
                                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-64">
                                  {log.stack}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Search</CardTitle>
                  <CardDescription>
                    Search users by name, email, user ID, or role
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchUsers} disabled={userLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${userLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search 
                  className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" 
                  style={{ 
                    top: '50%',
                    transform: 'translateY(-50%)',
                    willChange: 'transform'
                  }} 
                />
                <Input
                  placeholder="Search by name, email, or user ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[600px]">
                {userLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {userSearch ? 'No users found' : 'Start typing to search users'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-all duration-200 hover:shadow-md apple-hover"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar>
                            <AvatarImage src={user.image || ''} />
                            <AvatarFallback>
                              {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{highlightText(user.name || 'No name', userSearch)}</p>
                            <p className="text-sm text-muted-foreground">{highlightText(user.email, userSearch)}</p>
                            <p className="text-xs text-muted-foreground mt-1">ID: {highlightText(user.id, userSearch)}</p>
                            {user.memberships && user.memberships.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {user.memberships.map((membership: any) => (
                                  <Badge key={membership.id} variant="outline">
                                    {membership.club?.name 
                                      ? (membership.team?.name ? `${membership.club.name} - ${membership.team.name}` : membership.club.name)
                                      : (membership.team?.name || 'No club/team')} ({membership.role})
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExportUser(user)
                            }}
                            title="Export user data"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setUserToDelete(user)
                              setDeleteDialogOpen(true)
                            }}
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Control Tab */}
        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dev Panel Email Whitelist</CardTitle>
                  <CardDescription>
                    Manage which email addresses are authorized to access the dev panel
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchWhitelist} disabled={whitelistLoading || whitelistSaving}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${whitelistLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Email Form */}
              <div className="p-4 border rounded-xl bg-muted/30 backdrop-blur-sm">
                <Label className="text-sm font-medium mb-2 block">Add Email to Whitelist</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddEmail()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleAddEmail} 
                    disabled={whitelistSaving || !newEmail.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Email List */}
              <ScrollArea className="h-[600px]">
                {whitelistLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : whitelistEmails.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No emails in whitelist
                  </div>
                ) : (
                  <div className="space-y-2">
                    {whitelistEmails.map((item) => (
                      <div
                        key={item.email}
                        className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-all duration-200 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={item.image || ''} alt={item.name || item.email} />
                            <AvatarFallback>
                              {item.name?.charAt(0) || item.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            {item.name && (
                              <span className="text-sm font-medium">{item.name}</span>
                            )}
                            <span className="text-sm text-muted-foreground">{item.email}</span>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveEmail(item.email)}
                          disabled={whitelistSaving || whitelistEmails.length <= 1}
                          title={whitelistEmails.length <= 1 ? 'Cannot remove all emails' : 'Remove email'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {whitelistSaving && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Saving...</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.name || userToDelete?.email}?
              This will permanently delete all their data including memberships, events, and posts.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

