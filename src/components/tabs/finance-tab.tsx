'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { JSX } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import { DollarSign, Plus, Edit, Trash2, CheckCircle, XCircle, Clock, ShoppingCart, Download, Settings, AlertTriangle, Wallet, Search, Filter, Cloud, Building2, Briefcase, FileText } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { SaveIndicator } from '@/components/ui/save-indicator'
import { ButtonLoading, PageLoading } from '@/components/ui/loading-spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBackgroundRefresh } from '@/hooks/use-background-refresh'

interface FinanceTabProps {
  clubId: string
  isAdmin: boolean
  currentMembershipId: string
  currentMembershipTeamId?: string | null
  division?: 'B' | 'C'
  initialExpenses?: Expense[]
  initialPurchaseRequests?: PurchaseRequest[]
  initialBudgets?: EventBudget[]
  initialTeams?: Team[]
}

interface Expense {
  id: string
  description: string
  category: string | null
  amount: number
  date: string
  notes: string | null
  purchaseRequestId: string | null
  eventId: string | null
  addedById: string
  createdAt: string
  updatedAt: string
  event?: {
    id: string
    name: string
    slug: string
  }
  purchaseRequest?: {
    id: string
    requesterId: string
    description: string
  }
  addedBy?: {
    id: string
    subclubId: string | null
    team: {
      id: string
      name: string
    } | null
    user?: {
      id: string
      name: string | null
      image: string | null
      email: string
    } | null
  } | null
}

interface PurchaseRequest {
  id: string
  clubId: string
  eventId: string | null
  subclubId: string | null
  requesterId: string
  description: string
  category: string | null
  estimatedAmount: number
  justification: string | null
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'COMPLETED'
  reviewedById: string | null
  reviewNote: string | null
  reviewedAt: string | null
  adminOverride: boolean
  createdAt: string
  updatedAt: string
  event?: {
    id: string
    name: string
    slug: string
  }
  team?: {
    id: string
    name: string
  } | null
  expense?: {
    id: string
    amount: number
    date: string
  }
  requester?: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
}

interface Event {
  id: string
  name: string
  slug: string
  division: 'B' | 'C'
}

interface Team {
  id: string
  name: string
  clubId: string
}

interface EventBudget {
  id: string
  clubId: string
  eventId: string
  subclubId: string | null
  maxBudget: number
  createdAt: string
  updatedAt: string
  event: {
    id: string
    name: string
    slug: string
    division: 'B' | 'C'
  }
  team?: {
    id: string
    name: string
  } | null
  totalSpent: number
  totalRequested: number
  remaining: number
}

// Helper function to highlight search terms in text (exact copy from dev panel)
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

export default function FinanceTab({ clubId, isAdmin, currentMembershipId, currentMembershipTeamId, division, initialExpenses, initialPurchaseRequests, initialBudgets, initialTeams }: FinanceTabProps) {
  const { toast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses || [])
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>(initialPurchaseRequests || [])
  const [events, setEvents] = useState<Event[]>([])
  const [teams, setTeams] = useState<Team[]>(initialTeams || [])
  const [budgets, setBudgets] = useState<EventBudget[]>(initialBudgets || [])
  const [loading, setLoading] = useState(!initialExpenses && !initialPurchaseRequests && !initialBudgets)

  // Add Expense Dialog
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    eventId: '',
  })
  const [addingExpense, setAddingExpense] = useState(false)

  // Edit Expense Dialog
  const [editExpenseOpen, setEditExpenseOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editExpenseForm, setEditExpenseForm] = useState({
    description: '',
    category: '',
    amount: '',
    date: '',
    notes: '',
    eventId: '',
  })
  const [updatingExpense, setUpdatingExpense] = useState(false)

  // Delete Expense Dialog
  const [deleteExpenseOpen, setDeleteExpenseOpen] = useState(false)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const [deletingExpenseLoading, setDeletingExpenseLoading] = useState(false)

  // Purchase Request Dialog
  const [requestPurchaseOpen, setRequestPurchaseOpen] = useState(false)
  const [purchaseRequestForm, setPurchaseRequestForm] = useState({
    description: '',
    category: '',
    estimatedAmount: '',
    justification: '',
    eventId: '',
  })
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null)
  const [submittingRequest, setSubmittingRequest] = useState(false)

  // Review Purchase Request Dialog
  const [reviewRequestOpen, setReviewRequestOpen] = useState(false)
  const [reviewingRequest, setReviewingRequest] = useState<PurchaseRequest | null>(null)
  const [reviewForm, setReviewForm] = useState({
    status: 'APPROVED' as 'APPROVED' | 'DENIED',
    reviewNote: '',
    actualAmount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    expenseNotes: '',
    adminOverride: false,
  })
  const [reviewBudgetWarning, setReviewBudgetWarning] = useState<string | null>(null)

  // Budget Management
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<EventBudget | null>(null)
  const [budgetForm, setBudgetForm] = useState({
    eventId: '',
    subclubId: '',
    maxBudget: '',
  })
  const [savingBudget, setSavingBudget] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [saveIndicator, setSaveIndicator] = useState(false)
  const [deleteBudgetDialogOpen, setDeleteBudgetDialogOpen] = useState(false)
  const [budgetToDelete, setBudgetToDelete] = useState<EventBudget | null>(null)
  const [deletingBudget, setDeletingBudget] = useState(false)
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterEvent, setFilterEvent] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all')

  const fetchData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const requests: Promise<Response | null>[] = [
        fetch(`/api/expenses?clubId=${clubId}`),
        fetch(`/api/purchase-requests?clubId=${clubId}`),
        fetch(`/api/event-budgets?clubId=${clubId}`),
        fetch(`/api/clubs/${clubId}/teams`),
      ]

      if (division) {
        requests.push(fetch(`/api/events?division=${division}`))
      } else {
        requests.push(Promise.resolve(null))
      }

      const [expensesRes, requestsRes, budgetsRes, teamsRes, eventsRes] = await Promise.all(requests)

      if (expensesRes?.ok) {
        const data = await expensesRes.json()
        setExpenses(data.expenses)
      }

      if (requestsRes?.ok) {
        const data = await requestsRes.json()
        setPurchaseRequests(data.purchaseRequests)
      }

      if (budgetsRes?.ok) {
        const data = await budgetsRes.json()
        setBudgets(data.budgets || [])
      }

      if (teamsRes?.ok) {
        const data = await teamsRes.json()
        setTeams(data.teams || [])
      }

      if (eventsRes?.ok) {
        const data = await eventsRes.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch finance data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load finance data',
        variant: 'destructive',
      })
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [clubId, division, toast])

  useEffect(() => {
    // Skip initial fetch if we already have data from server
    if (!initialExpenses && !initialPurchaseRequests && !initialBudgets && !initialTeams) {
      fetchData()
    } else {
      // We have initial data, but may need to fetch missing pieces (events, teams if not provided)
      const loadMissingData = async () => {
        try {
          const requests: Promise<Response | null>[] = []
          
          // Only fetch what's missing
          if (!initialTeams) {
            requests.push(fetch(`/api/clubs/${clubId}/teams`))
          } else {
            requests.push(Promise.resolve(null))
          }
          
          if (division && events.length === 0) {
            requests.push(fetch(`/api/events?division=${division}`))
          } else {
            requests.push(Promise.resolve(null))
          }
          
          const [teamsRes, eventsRes] = await Promise.all(requests)
          
          if (teamsRes?.ok) {
            const data = await teamsRes.json()
            setTeams(data.teams || [])
          }
          
          if (eventsRes?.ok) {
            const data = await eventsRes.json()
            setEvents(data.events || [])
          }
        } catch (error) {
          console.error('Failed to fetch missing finance data:', error)
        } finally {
          setLoading(false)
        }
      }
      
      // Set initial data
      if (initialExpenses) setExpenses(initialExpenses)
      if (initialPurchaseRequests) setPurchaseRequests(initialPurchaseRequests)
      if (initialBudgets) setBudgets(initialBudgets)
      if (initialTeams) setTeams(initialTeams)
      
      loadMissingData()
    }
  }, [fetchData, initialExpenses, initialPurchaseRequests, initialBudgets, initialTeams, clubId, division, events.length])

  useBackgroundRefresh(
    () => fetchData({ silent: true }),
    {
      intervalMs: 45_000,
      runOnMount: false,
    },
  )

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingExpense(true)

    const expenseData = {
      clubId,
      eventId: expenseForm.eventId || undefined,
      description: expenseForm.description,
      category: expenseForm.category || undefined,
      amount: parseFloat(expenseForm.amount),
      date: new Date(expenseForm.date).toISOString(),
      notes: expenseForm.notes || undefined,
    }

    // Optimistic update - create temporary expense
    const tempExpense: Expense = {
      id: `temp-${Date.now()}`,
      ...expenseData,
      category: expenseData.category || null,
      notes: expenseData.notes || null,
      eventId: expenseData.eventId || null,
      date: expenseForm.date,
      event: expenseForm.eventId ? events.find(e => e.id === expenseForm.eventId) : undefined,
      purchaseRequestId: null,
      addedById: currentMembershipId,
      addedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setExpenses(prev => [tempExpense, ...prev])
    setExpenseForm({
      description: '',
      category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      eventId: '',
    })
    setAddExpenseOpen(false)

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setExpenses(prev => prev.filter(e => e.id !== tempExpense.id))
        const data = await response.json()
        throw new Error(data.error || 'Failed to add expense')
      }

      const data = await response.json()
      // Always refetch expenses to get full data with addedBy field and user info
      await fetchData()
      setSaveIndicator(true)
      
      toast({
        title: 'Expense Added',
        description: 'The expense has been added to the spreadsheet',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add expense',
        variant: 'destructive',
      })
    } finally {
      setAddingExpense(false)
    }
  }

  const handleEditExpenseClick = (expense: Expense) => {
    setEditingExpense(expense)
    setEditExpenseForm({
      description: expense.description,
      category: expense.category || '',
      amount: expense.amount.toString(),
      date: new Date(expense.date).toISOString().split('T')[0],
      notes: expense.notes || '',
      eventId: expense.eventId || '',
    })
    setEditExpenseOpen(true)
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExpense) return

    setUpdatingExpense(true)

    const updateData = {
      eventId: editExpenseForm.eventId || null,
      description: editExpenseForm.description,
      category: editExpenseForm.category || undefined,
      amount: parseFloat(editExpenseForm.amount),
      date: new Date(editExpenseForm.date).toISOString(),
      notes: editExpenseForm.notes || undefined,
    }

    // Optimistic update
    const originalExpense = editingExpense
    const optimisticExpense: Expense = {
      ...editingExpense,
      ...updateData,
      date: editExpenseForm.date,
      amount: parseFloat(editExpenseForm.amount),
      category: updateData.category ?? editingExpense.category ?? null,
      notes: updateData.notes ?? editingExpense.notes ?? null,
      eventId: updateData.eventId ?? editingExpense.eventId ?? null,
      event: editExpenseForm.eventId ? events.find(e => e.id === editExpenseForm.eventId) : undefined,
      updatedAt: new Date().toISOString(),
    }

    setExpenses(prev => prev.map(e => e.id === editingExpense.id ? optimisticExpense : e))
    setEditExpenseOpen(false)
    setEditingExpense(null)

    try {
      const response = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        // Revert optimistic update
        setExpenses(prev => prev.map(e => e.id === editingExpense.id ? originalExpense : e))
        const data = await response.json()
        throw new Error(data.error || 'Failed to update expense')
      }

      const data = await response.json()
      // Always refetch to get full data with addedBy field and user info
      await fetchData()
      setSaveIndicator(true)
      
      toast({
        title: 'Expense Updated',
        description: 'The expense has been updated',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update expense',
        variant: 'destructive',
      })
    } finally {
      setUpdatingExpense(false)
    }
  }

  const handleDeleteExpenseClick = (expense: Expense) => {
    setDeletingExpense(expense)
    setDeleteExpenseOpen(true)
  }

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return

    setDeletingExpenseLoading(true)

    // Optimistic update
    const expenseToDelete = deletingExpense
    setExpenses(prev => prev.filter(e => e.id !== deletingExpense.id))
    setDeleteExpenseOpen(false)
    setDeletingExpense(null)

    try {
      const response = await fetch(`/api/expenses/${expenseToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Revert optimistic update
        setExpenses(prev => [...prev, expenseToDelete].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ))
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete expense')
      }

      setSaveIndicator(true)
      toast({
        title: 'Expense Deleted',
        description: 'The expense has been removed',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete expense',
        variant: 'destructive',
      })
    } finally {
      setDeletingExpenseLoading(false)
    }
  }

  const handleRequestPurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingRequest(true)
    setBudgetWarning(null)

    try {
      const response = await fetch('/api/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          eventId: purchaseRequestForm.eventId || undefined,
          description: purchaseRequestForm.description,
          category: purchaseRequestForm.category || undefined,
          estimatedAmount: parseFloat(purchaseRequestForm.estimatedAmount),
          justification: purchaseRequestForm.justification || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (data.code === 'BUDGET_EXCEEDED') {
          setBudgetWarning(data.error)
          throw new Error(data.error)
        }
        throw new Error(data.error || 'Failed to submit request')
      }

      const data = await response.json()
      const newRequest = data.purchaseRequest

      // Update local state immediately
      // Note: requester info will be populated on next data fetch, but the request will appear immediately
      setPurchaseRequests((prev) => [newRequest, ...prev])

      toast({
        title: 'Request Submitted',
        description: 'Your purchase request has been submitted for review',
      })

      setPurchaseRequestForm({
        description: '',
        category: '',
        estimatedAmount: '',
        justification: '',
        eventId: '',
      })
      setRequestPurchaseOpen(false)
      setSaveIndicator(true)
    } catch (error: any) {
      // Error already shown via budgetWarning or toast
      if (!error.message.includes('exceeds remaining budget')) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to submit request',
          variant: 'destructive',
        })
      }
    } finally {
      setSubmittingRequest(false)
    }
  }

  const handleReviewRequestClick = async (request: PurchaseRequest) => {
    setReviewingRequest(request)
    setReviewBudgetWarning(null)

    // Check budget if event is specified
    if (request.eventId) {
      const budget = budgets.find(b => b.eventId === request.eventId)
      if (budget) {
        const requestAmount = request.estimatedAmount
        if (requestAmount > budget.remaining) {
          setReviewBudgetWarning(
            `This request exceeds the remaining budget by $${(requestAmount - budget.remaining).toFixed(2)}. Remaining: $${budget.remaining.toFixed(2)}`
          )
        }
      }
    }

    setReviewForm({
      status: 'APPROVED',
      reviewNote: '',
      actualAmount: request.estimatedAmount.toString(),
      expenseDate: new Date().toISOString().split('T')[0],
      expenseNotes: '',
      adminOverride: false,
    })
    setReviewRequestOpen(true)
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewingRequest) return

    setSubmittingReview(true)

    try {
      const response = await fetch(`/api/purchase-requests/${reviewingRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewForm.status,
          reviewNote: reviewForm.reviewNote || undefined,
          addToExpenses: reviewForm.status === 'APPROVED',
          actualAmount: reviewForm.status === 'APPROVED' ? parseFloat(reviewForm.actualAmount) : undefined,
          expenseDate: reviewForm.status === 'APPROVED' ? new Date(reviewForm.expenseDate).toISOString() : undefined,
          expenseNotes: reviewForm.status === 'APPROVED' ? reviewForm.expenseNotes || undefined : undefined,
          adminOverride: reviewForm.adminOverride,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to review request')
      }

      const data = await response.json()
      const updatedRequest = data.purchaseRequest
      const newExpense = data.expense

      // Update local state immediately
      setPurchaseRequests((prev) =>
        prev.map((req) => (req.id === reviewingRequest.id ? updatedRequest : req))
      )

      // If an expense was created, fetch the full expense list to get addedBy info
      if (newExpense && reviewForm.status === 'APPROVED') {
        try {
          const expenseResponse = await fetch(`/api/expenses?clubId=${clubId}`)
          if (expenseResponse.ok) {
            const expenseData = await expenseResponse.json()
            setExpenses(expenseData.expenses)
          }
        } catch (err) {
          // If we can't fetch, the expense will appear on next refresh
          console.warn('Failed to fetch updated expenses:', err)
        }
      }

      toast({
        title: reviewForm.status === 'APPROVED' ? 'Request Approved' : 'Request Denied',
        description: reviewForm.status === 'APPROVED' 
          ? 'The purchase request has been approved'
          : 'The purchase request has been denied',
      })

      setReviewRequestOpen(false)
      setReviewingRequest(null)
      setSaveIndicator(true)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to review request',
        variant: 'destructive',
      })
    } finally {
      setSubmittingReview(false)
    }
  }

  const getStatusBadge = (status: PurchaseRequest['status']) => {
    const statusConfig = {
      PENDING: { label: 'Pending', icon: Clock, variant: 'secondary' as const },
      APPROVED: { label: 'Approved', icon: CheckCircle, variant: 'default' as const },
      DENIED: { label: 'Denied', icon: XCircle, variant: 'destructive' as const },
      COMPLETED: { label: 'Approved', icon: CheckCircle, variant: 'default' as const },
    }
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingBudget(true)

    try {
      const response = await fetch('/api/event-budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          eventId: budgetForm.eventId,
          subclubId: budgetForm.subclubId || null,
          maxBudget: parseFloat(budgetForm.maxBudget),
          ...(editingBudget && { budgetId: editingBudget.id }),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save budget')
      }

      const result = await response.json()
      
      // Optimistically update budgets
      if (result.budget) {
        setBudgets((prev) => {
          const exists = prev.some(b => b.id === result.budget.id)
          if (exists) {
            return prev.map(b => b.id === result.budget.id ? result.budget : b)
          }
          return [...prev, result.budget]
        })
      }

      setSaveIndicator(true)
      toast({
        title: 'Budget Saved',
        description: 'Event budget has been updated',
      })

      setBudgetDialogOpen(false)
      setEditingBudget(null)
      setBudgetForm({ eventId: '', subclubId: '', maxBudget: '' })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save budget',
        variant: 'destructive',
      })
    } finally {
      setSavingBudget(false)
    }
  }

  const handleEditBudgetClick = (budget: EventBudget) => {
    setEditingBudget(budget)
    setBudgetForm({
      eventId: budget.eventId,
      subclubId: budget.subclubId || '',
      maxBudget: budget.maxBudget.toString(),
    })
    setBudgetDialogOpen(true)
  }

  // Memoize expensive computations to avoid recalculating on every render
  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, exp) => sum + exp.amount, 0),
    [expenses]
  )
  
  // Calculate account balance
  // Since we only track expenses (no income), balance starts at 0 and goes negative
  // In a real system with income tracking, this would be: startingBalance + income - expenses
  const accountBalance = useMemo(() => -totalExpenses, [totalExpenses])
  const displayBalance = useMemo(() => Math.abs(accountBalance), [accountBalance])
  
  // Get current date for display
  const currentDate = useMemo(() => 
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    []
  )
  
  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          const searchInput = document.querySelector('input[placeholder*="search"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  // Combine expenses and purchase requests into transactions
  type Transaction = {
    id: string
    type: 'expense' | 'purchase_request'
    date: string
    description: string
    amount: number
    category: string | null
    event?: { id: string; name: string; slug: string }
    team?: { id: string; name: string } | null
    status?: 'PENDING' | 'APPROVED' | 'DENIED' | 'COMPLETED'
    isPending?: boolean
    addedBy?: { 
      id: string
      subclubId: string | null
      team: { id: string; name: string } | null
      user?: {
        id: string
        name: string | null
        image: string | null
        email: string
      } | null
    } | null
  }
  
  const transactions = useMemo<Transaction[]>(() => [
    ...expenses.map(exp => ({
      id: exp.id,
      type: 'expense' as const,
      date: exp.date,
      description: exp.description,
      amount: -exp.amount, // Negative for expenses
      category: exp.category,
      event: exp.event,
      team: exp.addedBy?.team || null,
      isPending: false,
      addedBy: exp.addedBy,
    })),
    ...purchaseRequests
      .filter(req => req.status === 'PENDING')
      .map(req => ({
        id: req.id,
        type: 'purchase_request' as const,
        date: req.createdAt,
        description: req.description,
        amount: -req.estimatedAmount, // Negative for pending requests
        category: req.category,
        event: req.event || undefined,
        team: req.team || null,
        status: req.status,
        isPending: true,
        addedBy: req.requester ? {
          id: req.requesterId,
          subclubId: req.subclubId,
          team: req.team || null,
          user: req.requester,
        } : null,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [expenses, purchaseRequests])
  
  // Filter transactions based on search and filters
  const filteredTransactions = useMemo(() => transactions.filter(transaction => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = (
        transaction.description.toLowerCase().includes(query) ||
        transaction.category?.toLowerCase().includes(query) ||
        transaction.event?.name.toLowerCase().includes(query) ||
        transaction.team?.name.toLowerCase().includes(query)
      )
      if (!matchesSearch) return false
    }
    
    // Category filter
    if (filterCategory && transaction.category !== filterCategory) {
      return false
    }
    
    // Event filter
    if (filterEvent && transaction.event?.id !== filterEvent) {
      return false
    }
    
    // Status filter
    if (filterStatus === 'pending' && !transaction.isPending) {
      return false
    }
    if (filterStatus === 'completed' && transaction.isPending) {
      return false
    }
    
    return true
  }), [transactions, searchQuery, filterCategory, filterEvent, filterStatus])
  
  // Get unique categories and events for filter dropdown
  const uniqueCategories = useMemo(() => Array.from(new Set(
    transactions
      .map(t => t.category)
      .filter((c): c is string => c !== null)
  )).sort(), [transactions])
  
  const uniqueEvents = useMemo(() => Array.from(new Set(
    transactions
      .map(t => t.event?.id)
      .filter((id): id is string => id !== undefined)
  )), [transactions])
  
  const eventMap = useMemo(() => new Map(events.map(e => [e.id, e])), [events])
  
  // Calculate expense history for simple trend visualization
  const expenseHistory = useMemo(() => expenses
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc, exp) => {
      const date = new Date(exp.date).toISOString().split('T')[0]
      const lastTotal = acc.length > 0 ? acc[acc.length - 1].total : 0
      acc.push({ date, total: lastTotal + exp.amount })
      return acc
    }, [] as { date: string; total: number }[]), [expenses])
  
  // Get last 7 data points for trend
  const recentExpenseHistory = useMemo(() => expenseHistory.slice(-7), [expenseHistory])
  const minExpense = useMemo(() => Math.min(...recentExpenseHistory.map(h => h.total), 0), [recentExpenseHistory])
  const maxExpense = useMemo(() => Math.max(...recentExpenseHistory.map(h => h.total), 0), [recentExpenseHistory])
  const expenseRange = useMemo(() => maxExpense - minExpense || 1, [minExpense, maxExpense])
  
  // Get transaction icon
  const getTransactionIcon = (transaction: Transaction) => {
    if (transaction.type === 'purchase_request') {
      return ShoppingCart
    }
    if (transaction.category?.toLowerCase().includes('fiscal') || transaction.description.toLowerCase().includes('fiscal')) {
      return Building2
    }
    if (transaction.description.toLowerCase().includes('invoice') || transaction.description.toLowerCase().includes('invoice to')) {
      return Briefcase
    }
    return FileText
  }
  
  // Get initials for tags
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  
  // Get color for tag
  const getTagColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-orange-500',
      'bg-red-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-indigo-500',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  // Calculate team expenses based on purchaser's team
  const teamExpenses = useMemo(() => expenses.reduce((acc, exp) => {
    const purchaserTeam = exp.addedBy?.team
    const subclubId = purchaserTeam?.id || 'club-wide'
    const teamName = purchaserTeam?.name || 'Club-wide'
    
    if (!acc[subclubId]) {
      acc[subclubId] = {
        id: subclubId,
        name: teamName,
        total: 0,
      }
    }
    acc[subclubId].total += exp.amount
    return acc
  }, {} as Record<string, { id: string; name: string; total: number }>), [expenses])

  const teamExpensesList = useMemo(() => Object.values(teamExpenses).sort((a, b) => {
    // Put "Club-wide" at the end
    if (a.id === 'club-wide') return 1
    if (b.id === 'club-wide') return -1
    return a.name.localeCompare(b.name)
  }), [teamExpenses])

  const handleExportCSV = () => {
    // Helper function to escape CSV values
    const escapeCSV = (value: string | null | undefined): string => {
      if (!value) return ''
      // Replace quotes with double quotes and wrap in quotes if contains comma, quote, or newline
      const escaped = value.replace(/"/g, '""')
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r')) {
        return `"${escaped}"`
      }
      return escaped
    }

    // Create CSV header with comprehensive fields
    const headers = [
      'Type',
      'Status',
      'Date',
      'Description',
      'Category',
      'Amount',
      'Event',
      'Team',
      'Added By',
      'Added By Email',
      'Notes/Justification',
      'Created At',
      'Updated At'
    ]
    const csvRows = [headers.join(',')]

    // Create maps for quick lookup of full expense and purchase request data
    const expenseMap = new Map(expenses.map(e => [e.id, e]))
    const purchaseRequestMap = new Map(purchaseRequests.map(pr => [pr.id, pr]))

    // Add transaction rows (using filtered transactions)
    filteredTransactions.forEach((transaction) => {
      const isExpense = transaction.type === 'expense'
      const sourceData = isExpense 
        ? expenseMap.get(transaction.id)
        : purchaseRequestMap.get(transaction.id)
      
      const amount = Math.abs(transaction.amount)
      const formattedDate = new Date(transaction.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
      
      let addedByName = ''
      let addedByEmail = ''
      let notes = ''
      
      if (isExpense && sourceData) {
        const expense = sourceData as Expense
        addedByName = expense.addedBy?.user?.name || ''
        addedByEmail = expense.addedBy?.user?.email || ''
        notes = expense.notes || ''
      } else if (!isExpense && sourceData) {
        const pr = sourceData as PurchaseRequest
        addedByName = pr.requester?.name || ''
        addedByEmail = pr.requester?.email || ''
        notes = pr.justification || ''
      }

      const row = [
        escapeCSV(isExpense ? 'Expense' : 'Purchase Request'),
        escapeCSV(transaction.status || (transaction.isPending ? 'PENDING' : 'COMPLETED')),
        escapeCSV(formattedDate),
        escapeCSV(transaction.description),
        escapeCSV(transaction.category || ''),
        amount.toFixed(2), // Amount without quotes for Excel compatibility
        escapeCSV(transaction.event?.name || ''),
        escapeCSV(transaction.team?.name || ''),
        escapeCSV(addedByName),
        escapeCSV(addedByEmail),
        escapeCSV(notes),
        escapeCSV(sourceData ? new Date(sourceData.createdAt).toLocaleString('en-US') : ''),
        escapeCSV(sourceData ? new Date(sourceData.updatedAt).toLocaleString('en-US') : ''),
      ]
      csvRows.push(row.join(','))
    })

    // Add summary section
    csvRows.push('')
    csvRows.push('Summary')
    csvRows.push('Total Transactions,' + filteredTransactions.length)
    
    const totalExpenseAmount = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const totalPendingAmount = filteredTransactions
      .filter(t => t.isPending)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    
    csvRows.push(`Total Expenses,${totalExpenseAmount.toFixed(2)}`)
    csvRows.push(`Total Pending Requests,${totalPendingAmount.toFixed(2)}`)
    
    // Add category breakdown if there are categories
    const categoryTotals = new Map<string, number>()
    filteredTransactions.forEach(t => {
      if (t.category) {
        const current = categoryTotals.get(t.category) || 0
        categoryTotals.set(t.category, current + Math.abs(t.amount))
      }
    })
    
    if (categoryTotals.size > 0) {
      csvRows.push('')
      csvRows.push('Category Breakdown')
      Array.from(categoryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, total]) => {
          csvRows.push(`${escapeCSV(category)},${total.toFixed(2)}`)
        })
    }

    // Create CSV content
    const csvContent = csvRows.join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    // Generate filename with date and filter info
    const dateStr = new Date().toISOString().split('T')[0]
    let filename = `transactions-${dateStr}`
    if (filterCategory) filename += `-${filterCategory.replace(/[^a-z0-9]/gi, '_')}`
    if (filterEvent) {
      const eventName = eventMap.get(filterEvent)?.name || 'event'
      filename += `-${eventName.replace(/[^a-z0-9]/gi, '_')}`
    }
    if (filterStatus !== 'all') filename += `-${filterStatus}`
    link.setAttribute('download', `${filename}.csv`)
    
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Export Successful',
      description: `Exported ${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? 's' : ''} to CSV`,
    })
  }

  // Calculate pending purchase requests count
  const pendingRequestsCount = useMemo(() => 
    purchaseRequests.filter(req => req.status === 'PENDING').length,
    [purchaseRequests]
  )
  const userPendingRequests = useMemo(() => 
    purchaseRequests.filter(req => 
      req.requesterId === currentMembershipId && req.status === 'PENDING'
    ).length,
    [purchaseRequests, currentMembershipId]
  )

  if (loading) {
    return (
      <PageLoading
        title="Loading finances"
        description="Fetching expenses and budget information..."
        variant="orbit"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Quick Stats */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold">Finance</h2>
            <SaveIndicator show={saveIndicator} />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button 
              onClick={() => setRequestPurchaseOpen(true)}
              size="sm"
              className="flex-1 sm:flex-none text-xs sm:text-sm whitespace-nowrap"
            >
              <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="hidden md:inline">Request Purchase</span>
              <span className="md:hidden">Request</span>
            </Button>
            {isAdmin && (
              <Button 
                onClick={() => setAddExpenseOpen(true)}
                size="sm"
                className="flex-1 sm:flex-none text-xs sm:text-sm whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="hidden md:inline">Add Expense</span>
                <span className="md:hidden">Expense</span>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    ${displayBalance.toFixed(2)}
                  </p>
                </div>
                {recentExpenseHistory.length > 1 && (
                  <div className="flex items-end gap-0.5 h-10 w-16">
                    {recentExpenseHistory.map((point, idx) => {
                      const height = ((point.total - minExpense) / expenseRange) * 100
                      return (
                        <div
                          key={idx}
                          className="flex-1 rounded-t bg-red-500 dark:bg-red-400"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {teamExpensesList.length > 0 && teamExpensesList.length <= 3 && (
            teamExpensesList.map((teamExp) => (
              <Card key={teamExp.id}>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground mb-1">{teamExp.name}</p>
                  <p className="text-xl font-semibold">${teamExp.total.toFixed(2)}</p>
                </CardContent>
              </Card>
            ))
          )}

          {budgets.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-1">Active Budgets</p>
                <p className="text-xl font-semibold">{budgets.length}</p>
              </CardContent>
            </Card>
          )}

          {(pendingRequestsCount > 0 || userPendingRequests > 0) && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground mb-1">
                  {isAdmin ? 'Pending Requests' : 'Your Requests'}
                </p>
                <p className="text-xl font-semibold">
                  {isAdmin ? pendingRequestsCount : userPendingRequests}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Transactions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transactions</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 text-xs sm:text-sm"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" style={{ imageRendering: 'crisp-edges', WebkitFontSmoothing: 'antialiased' }} />
              </div>
              <Input
                type="text"
                placeholder="Type / to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === '/' && e.target === document.activeElement) {
                    e.preventDefault()
                  }
                }}
                className="pl-11 pr-12 h-11 bg-background/50 border-border/50 focus:bg-background focus:border-border"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-7 w-7 p-0 ${showFilters ? 'bg-accent' : ''}`}
                  title="Filter transactions"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-3 p-4 border rounded-lg bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Filters</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterCategory(null)
                      setFilterEvent(null)
                      setFilterStatus('all')
                    }}
                    className="h-7 text-xs"
                  >
                    Clear all
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="filter-status" className="text-xs text-muted-foreground mb-1 block">Status</Label>
                    <Select
                      value={filterStatus}
                      onValueChange={(value) => setFilterStatus(value as 'all' | 'pending' | 'completed')}
                    >
                      <SelectTrigger id="filter-status" className="h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {uniqueCategories.length > 0 && (
                    <div>
                      <Label htmlFor="filter-category" className="text-xs text-muted-foreground mb-1 block">Category</Label>
                      <Select
                        value={filterCategory || undefined}
                        onValueChange={(value) => setFilterCategory(value || null)}
                      >
                        <SelectTrigger id="filter-category" className="h-9">
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                      <SelectContent>
                        {uniqueCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                      </Select>
                    </div>
                  )}
                  {uniqueEvents.length > 0 && (
                    <div>
                      <Label htmlFor="filter-event" className="text-xs text-muted-foreground mb-1 block">Event</Label>
                      <Select
                        value={filterEvent || undefined}
                        onValueChange={(value) => setFilterEvent(value || null)}
                      >
                        <SelectTrigger id="filter-event" className="h-9">
                          <SelectValue placeholder="All events" />
                        </SelectTrigger>
                      <SelectContent>
                        {uniqueEvents.map(eventId => {
                          const event = eventMap.get(eventId)
                          return event ? (
                            <SelectItem key={eventId} value={eventId}>{event.name}</SelectItem>
                          ) : null
                        })}
                      </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Transactions Table */}
          <div className="space-y-1">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? 'No transactions match your search' : 'No transactions yet'}
              </div>
            ) : (
              filteredTransactions.map((transaction) => {
                const Icon = getTransactionIcon(transaction)
                const isExpense = transaction.amount < 0
                const amount = Math.abs(transaction.amount)
                const date = new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                
                return (
                  <div
                    key={transaction.id}
                    className={`group flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      isExpense
                        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200/50 dark:border-red-900/50 hover:bg-red-100/50 dark:hover:bg-red-950/30'
                        : 'bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-900/50 hover:bg-green-100/50 dark:hover:bg-green-950/30'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      isExpense
                        ? 'bg-red-100 dark:bg-red-900/50'
                        : 'bg-green-100 dark:bg-green-900/50'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        isExpense
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`} />
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {transaction.isPending && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                            Pending
                          </Badge>
                        )}
                        <span className="font-medium truncate">
                          {searchQuery ? highlightText(transaction.description, searchQuery) : transaction.description}
                        </span>
                      </div>
                      {transaction.event && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {searchQuery ? highlightText(transaction.event.name, searchQuery) : transaction.event.name}
                          </Badge>
                          {transaction.team && (
                            <Badge variant="outline" className="text-xs">
                              {searchQuery ? highlightText(transaction.team.name, searchQuery) : transaction.team.name}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Date and Amount */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-sm text-muted-foreground">{date}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-semibold ${
                          isExpense
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {isExpense ? '-' : '+'}${amount.toFixed(2)}
                        </span>
                        {transaction.addedBy?.user && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={transaction.addedBy.user.image || ''} />
                              <AvatarFallback className="text-xs">
                                {transaction.addedBy.user.name?.charAt(0)?.toUpperCase() || 
                                 transaction.addedBy.user.email?.charAt(0)?.toUpperCase() || 
                                 'U'}
                              </AvatarFallback>
                            </Avatar>
                            {transaction.team && (
                              <span className="text-sm text-muted-foreground font-medium">
                                {transaction.team.name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {isAdmin && transaction.type === 'expense' && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const expense = expenses.find(e => e.id === transaction.id)
                              if (expense) handleEditExpenseClick(expense)
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const expense = expenses.find(e => e.id === transaction.id)
                              if (expense) handleDeleteExpenseClick(expense)
                            }}
                            className="h-8 w-8 p-0 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event Budgets Section - Compact */}
      {budgets.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <CardTitle>Event Budgets</CardTitle>
              </div>
              {isAdmin && (
                <Button onClick={() => setBudgetDialogOpen(true)} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Set Budget
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {budgets.map((budget) => {
                const spentPercentage = Math.min((budget.totalSpent / budget.maxBudget) * 100, 100)
                return (
                  <div
                    key={budget.id}
                    className="p-3 border rounded-lg space-y-2 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {budget.event.name}
                          {budget.team && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {budget.team.name}
                            </Badge>
                          )}
                        </h4>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditBudgetClick(budget)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setBudgetToDelete(budget)
                              setDeleteBudgetDialogOpen(true)
                            }}
                            className="h-7 w-7 p-0 text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          ${budget.totalSpent.toFixed(2)} / ${budget.maxBudget.toFixed(2)}
                        </span>
                        <span className={`font-medium ${
                          budget.remaining < 0
                            ? 'text-red-600 dark:text-red-400'
                            : budget.remaining < budget.maxBudget * 0.2
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          ${budget.remaining.toFixed(2)} left
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            spentPercentage > 100
                              ? 'bg-red-500'
                              : spentPercentage > 80
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(spentPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {isAdmin && budgets.length === 0 && (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-3">No event budgets set yet.</p>
                <Button onClick={() => setBudgetDialogOpen(true)} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Set Budget
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Requests - Show pending for admins, all for members */}
      {((isAdmin && pendingRequestsCount > 0) || (!isAdmin && purchaseRequests.some(req => req.requesterId === currentMembershipId))) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isAdmin ? 'Pending Purchase Requests' : 'Your Purchase Requests'}
            </CardTitle>
            <CardDescription>
              {isAdmin 
                ? `${pendingRequestsCount} request${pendingRequestsCount !== 1 ? 's' : ''} awaiting review`
                : `View the status of your purchase requests`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {purchaseRequests
                .filter(req => {
                  if (isAdmin) return req.status === 'PENDING'
                  return req.requesterId === currentMembershipId
                })
                .map((request) => (
                  <div
                    key={request.id}
                    className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {request.requester && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={request.requester.image || ''} />
                          <AvatarFallback className="text-xs">
                            {request.requester.name?.charAt(0)?.toUpperCase() || 
                             request.requester.email?.charAt(0)?.toUpperCase() || 
                             'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{request.description}</h4>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">${request.estimatedAmount.toFixed(2)}</span>
                          {request.event && (
                            <>
                              <span>•</span>
                              <span>{request.event.name}</span>
                            </>
                          )}
                          {request.category && (
                            <>
                              <span>•</span>
                              <span>{request.category}</span>
                            </>
                          )}
                        </div>
                        {request.justification && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{request.justification}</p>
                        )}
                        {/* Show review decision for members */}
                        {!isAdmin && request.status !== 'PENDING' && (
                          <div className="mt-2 pt-2 border-t space-y-1">
                            {request.status === 'APPROVED' && (
                              <div className="flex items-center gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="font-medium text-green-600 dark:text-green-400">Approved</span>
                                {request.expense && (
                                  <span className="text-muted-foreground">
                                    • Added to expenses: ${request.expense.amount.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            )}
                            {request.reviewNote && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium">Comment:</p>
                                <p className="text-sm text-muted-foreground italic">
                                  &ldquo;{request.reviewNote}&rdquo;
                                </p>
                              </div>
                            )}
                            {request.reviewedAt && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(request.reviewedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isAdmin && request.status === 'PENDING' && (
                      <Button
                        size="sm"
                        onClick={() => handleReviewRequestClick(request)}
                        className="ml-4 flex-shrink-0"
                      >
                        Review
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Expense Dialog */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent>
          <form onSubmit={handleAddExpense}>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>Add a new expense to the team&apos;s finance spreadsheet</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {division && events.length > 0 && (
                <div>
                  <Label htmlFor="expense-event">Event (Optional)</Label>
                  <Select
                    value={expenseForm.eventId || undefined}
                    onValueChange={(value) => setExpenseForm({ ...expenseForm, eventId: value || '' })}
                  >
                    <SelectTrigger id="expense-event">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  required
                  maxLength={500}
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  placeholder="e.g., Equipment, Travel, Materials"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">Amount ($) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="Additional details..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddExpenseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addingExpense}>
                {addingExpense ? 'Adding...' : 'Add Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={editExpenseOpen} onOpenChange={setEditExpenseOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateExpense}>
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
              <DialogDescription>Update expense details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {division && events.length > 0 && (
                <div>
                  <Label htmlFor="edit-expense-event">Event (Optional)</Label>
                  <Select
                    value={editExpenseForm.eventId || undefined}
                    onValueChange={(value) => setEditExpenseForm({ ...editExpenseForm, eventId: value || '' })}
                  >
                    <SelectTrigger id="edit-expense-event">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="edit-description">Description *</Label>
                <Input
                  id="edit-description"
                  value={editExpenseForm.description}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, description: e.target.value })}
                  required
                  maxLength={500}
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editExpenseForm.category}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, category: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-amount">Amount ($) *</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editExpenseForm.amount}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-date">Date *</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editExpenseForm.date}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Input
                  id="edit-notes"
                  value={editExpenseForm.notes}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditExpenseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatingExpense}>
                {updatingExpense && <ButtonLoading />}
                {updatingExpense ? 'Updating...' : 'Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Dialog */}
      <Dialog open={deleteExpenseOpen} onOpenChange={setDeleteExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteExpenseOpen(false)
                setDeletingExpense(null)
              }}
              disabled={deletingExpenseLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteExpense}
              disabled={deletingExpenseLoading}
            >
              {deletingExpenseLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Purchase Dialog */}
      <Dialog open={requestPurchaseOpen} onOpenChange={setRequestPurchaseOpen}>
        <DialogContent>
          <form onSubmit={handleRequestPurchase}>
            <DialogHeader>
              <DialogTitle>Request Purchase</DialogTitle>
              <DialogDescription>
                Submit a purchase request for admin approval
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {division && events.length > 0 && (
                <div>
                  <Label htmlFor="req-event">Event (Optional)</Label>
                  <Select
                    value={purchaseRequestForm.eventId || undefined}
                    onValueChange={(value) => {
                      setPurchaseRequestForm({ ...purchaseRequestForm, eventId: value || '' })
                      setBudgetWarning(null)
                    }}
                  >
                    <SelectTrigger id="req-event">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                    {events
                      .filter((event) => {
                        // Admins can see all events
                        if (isAdmin) return true
                        
                        // Members can only see events that have budgets for their team (or club-wide)
                        if (!currentMembershipTeamId) {
                          // Member without team - only show events with club-wide budgets
                          return budgets.some(
                            (b) => b.eventId === event.id && b.subclubId === null
                          )
                        } else {
                          // Member with team - show events with their team's budget OR club-wide budget
                          return budgets.some(
                            (b) =>
                              b.eventId === event.id &&
                              (b.subclubId === currentMembershipTeamId || b.subclubId === null)
                          )
                        }
                      })
                      .map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isAdmin && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Only events with budgets for your team are shown
                    </p>
                  )}
                </div>
              )}
              {/* Budget Reminder - Shows when event is selected */}
              {purchaseRequestForm.eventId && (() => {
                const selectedEvent = events.find(e => e.id === purchaseRequestForm.eventId)
                const budget = budgets.find(b => {
                  if (b.eventId !== purchaseRequestForm.eventId) return false
                  // For members, find their team's budget or club-wide budget
                  if (!isAdmin && currentMembershipTeamId) {
                    return b.subclubId === currentMembershipTeamId || b.subclubId === null
                  } else if (!isAdmin) {
                    return b.subclubId === null
                  }
                  // For admins, show the first matching budget (they can see all)
                  return true
                })
                
                if (budget && selectedEvent) {
                  const requestAmount = parseFloat(purchaseRequestForm.estimatedAmount) || 0
                  const wouldExceed = requestAmount > budget.remaining
                  const teamName = budget.team ? ` (${budget.team.name})` : ''
                  
                  return (
                    <div className={`p-4 rounded-lg border-2 ${
                      wouldExceed 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800' 
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800'
                    }`}>
                      <div className="flex items-start gap-2 mb-3">
                        <Wallet className={`h-5 w-5 mt-0.5 ${
                          wouldExceed 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-blue-600 dark:text-blue-400'
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">
                            Budget Reminder: {selectedEvent.name}{teamName}
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Budget:</span>
                              <span className="font-medium">${budget.maxBudget.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Already Spent:</span>
                              <span className="font-medium">${budget.totalSpent.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pending Requests:</span>
                              <span className="font-medium">${budget.totalRequested.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-current/20">
                              <span className="font-semibold">Remaining Budget:</span>
                              <span className={`font-bold ${
                                budget.remaining < 0 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : budget.remaining < budget.maxBudget * 0.2
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-green-600 dark:text-green-400'
                              }`}>
                                ${budget.remaining.toFixed(2)}
                              </span>
                            </div>
                            {requestAmount > 0 && (
                              <div className="pt-2 mt-2 border-t border-current/20">
                                <div className="flex justify-between mb-1">
                                  <span className="text-muted-foreground">Your Request:</span>
                                  <span className="font-medium">${requestAmount.toFixed(2)}</span>
                                </div>
                                {wouldExceed && (
                                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs mt-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>This exceeds remaining budget by ${(requestAmount - budget.remaining).toFixed(2)}</span>
                                  </div>
                                )}
                                {!wouldExceed && budget.remaining - requestAmount >= 0 && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    After this request: ${(budget.remaining - requestAmount).toFixed(2)} remaining
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              })()}
              {budgetWarning && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">{budgetWarning}</p>
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="req-description">Description *</Label>
                <Input
                  id="req-description"
                  value={purchaseRequestForm.description}
                  onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, description: e.target.value })}
                  required
                  maxLength={500}
                  placeholder="What do you want to purchase?"
                />
              </div>
              <div>
                <Label htmlFor="req-category">Category</Label>
                <Input
                  id="req-category"
                  value={purchaseRequestForm.category}
                  onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, category: e.target.value })}
                  placeholder="e.g., Equipment, Travel, Materials"
                />
              </div>
              <div>
                <Label htmlFor="req-amount">Estimated Amount ($) *</Label>
                <Input
                  id="req-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseRequestForm.estimatedAmount}
                  onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, estimatedAmount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="req-justification">Justification</Label>
                <Input
                  id="req-justification"
                  value={purchaseRequestForm.justification}
                  onChange={(e) => setPurchaseRequestForm({ ...purchaseRequestForm, justification: e.target.value })}
                  placeholder="Why is this purchase needed?"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRequestPurchaseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingRequest}>
                {submittingRequest && <ButtonLoading />}
                {submittingRequest ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Purchase Request Dialog */}
      <Dialog open={reviewRequestOpen} onOpenChange={setReviewRequestOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmitReview}>
            <DialogHeader>
              <DialogTitle>Review Purchase Request</DialogTitle>
              <DialogDescription>
                Approve or deny this purchase request
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {reviewingRequest && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  {reviewingRequest.requester && (
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={reviewingRequest.requester.image || ''} />
                        <AvatarFallback className="text-xs">
                          {reviewingRequest.requester.name?.charAt(0)?.toUpperCase() || 
                           reviewingRequest.requester.email?.charAt(0)?.toUpperCase() || 
                           'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs text-muted-foreground">Requested by</p>
                        <p className="font-medium">
                          {reviewingRequest.requester.name || reviewingRequest.requester.email}
                        </p>
                      </div>
                    </div>
                  )}
                  <p><strong>Description:</strong> {reviewingRequest.description}</p>
                  {reviewingRequest.category && <p><strong>Category:</strong> {reviewingRequest.category}</p>}
                  <p><strong>Estimated Amount:</strong> ${reviewingRequest.estimatedAmount.toFixed(2)}</p>
                  {reviewingRequest.justification && (
                    <p><strong>Justification:</strong> {reviewingRequest.justification}</p>
                  )}
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={reviewForm.status === 'APPROVED' ? 'default' : 'outline'}
                  onClick={() => setReviewForm({ ...reviewForm, status: 'APPROVED' })}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  type="button"
                  variant={reviewForm.status === 'DENIED' ? 'destructive' : 'outline'}
                  onClick={() => setReviewForm({ ...reviewForm, status: 'DENIED' })}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny
                </Button>
              </div>

              {reviewForm.status === 'DENIED' && (
                <div>
                  <Label htmlFor="review-note">Review Note</Label>
                  <Input
                    id="review-note"
                    value={reviewForm.reviewNote}
                    onChange={(e) => setReviewForm({ ...reviewForm, reviewNote: e.target.value })}
                    placeholder="Optional feedback for the requester"
                  />
                </div>
              )}

              {reviewBudgetWarning && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">{reviewBudgetWarning}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Checkbox
                          id="admin-override"
                          checked={reviewForm.adminOverride}
                          onCheckedChange={(checked) => setReviewForm({ ...reviewForm, adminOverride: checked as boolean })}
                        />
                        <Label htmlFor="admin-override" className="cursor-pointer font-normal text-sm">
                          Admin Override (approve despite budget limit)
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {reviewForm.status === 'APPROVED' && (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    This request will be automatically added to expenses. You can adjust the values below if needed.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="actual-amount">Actual Amount ($) *</Label>
                      <Input
                        id="actual-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={reviewForm.actualAmount}
                        onChange={(e) => setReviewForm({ ...reviewForm, actualAmount: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="expense-date">Expense Date *</Label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={reviewForm.expenseDate}
                        onChange={(e) => setReviewForm({ ...reviewForm, expenseDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="expense-notes">Expense Notes</Label>
                    <Input
                      id="expense-notes"
                      value={reviewForm.expenseNotes}
                      onChange={(e) => setReviewForm({ ...reviewForm, expenseNotes: e.target.value })}
                      placeholder="Additional details for the expense record"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReviewRequestOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingReview}>
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Budget Management Dialog */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSaveBudget}>
            <DialogHeader>
              <DialogTitle>{editingBudget ? 'Edit Event Budget' : 'Set Event Budget'}</DialogTitle>
              <DialogDescription>
                Set the maximum budget for an event team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {division && events.length > 0 && (
                <div>
                  <Label htmlFor="budget-event">Event *</Label>
                  <Select
                    value={budgetForm.eventId || undefined}
                    onValueChange={(value) => setBudgetForm({ ...budgetForm, eventId: value || '' })}
                    required
                  >
                    <SelectTrigger id="budget-event">
                      <SelectValue placeholder="Select an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {teams.length > 0 && (
                <div>
                  <Label htmlFor="budget-team">Team (Optional)</Label>
                  <Select
                    value={budgetForm.subclubId || undefined}
                    onValueChange={(value) => setBudgetForm({ ...budgetForm, subclubId: value || '' })}
                  >
                    <SelectTrigger id="budget-team">
                      <SelectValue placeholder="Club-wide (all teams)" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for club-wide budget, or select a specific team
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="max-budget">Maximum Budget ($) *</Label>
                <Input
                  id="max-budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={budgetForm.maxBudget}
                  onChange={(e) => setBudgetForm({ ...budgetForm, maxBudget: e.target.value })}
                  required
                  placeholder="e.g., 75.00"
                />
              </div>
              {editingBudget && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p><strong>Current Spending:</strong> ${editingBudget.totalSpent.toFixed(2)}</p>
                  <p><strong>Remaining:</strong> ${editingBudget.remaining.toFixed(2)}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBudgetDialogOpen(false)
                  setEditingBudget(null)
                  setBudgetForm({ eventId: '', subclubId: '', maxBudget: '' })
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingBudget}>
                {savingBudget ? 'Saving...' : editingBudget ? 'Update Budget' : 'Set Budget'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Budget Confirmation Dialog */}
      <ConfirmDialog
        open={deleteBudgetDialogOpen}
        onOpenChange={setDeleteBudgetDialogOpen}
        title="Delete Budget"
        description="Are you sure you want to delete this budget? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (!budgetToDelete) return
          setDeletingBudget(true)
          try {
            const response = await fetch(`/api/event-budgets/${budgetToDelete.id}`, {
              method: 'DELETE',
            })
            if (response.ok) {
              setBudgets(prev => prev.filter(b => b.id !== budgetToDelete.id))
              setSaveIndicator(true)
              toast({
                title: 'Budget Deleted',
                description: 'The event budget has been removed',
              })
              setDeleteBudgetDialogOpen(false)
              setBudgetToDelete(null)
            } else {
              throw new Error('Failed to delete budget')
            }
          } catch (error: any) {
            toast({
              title: 'Error',
              description: error.message || 'Failed to delete budget',
              variant: 'destructive',
            })
          } finally {
            setDeletingBudget(false)
          }
        }}
      />
    </div>
  )
}

