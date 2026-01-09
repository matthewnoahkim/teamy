'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Plus, 
  Trash2, 
  Edit, 
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Flag,
  Clock,
  Users,
  Filter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ButtonLoading, PageLoading } from '@/components/ui/loading-spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format, isPast, isToday, isTomorrow } from 'date-fns'

interface TodoTabProps {
  clubId: string
  currentMembershipId: string
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  isAdmin: boolean
  initialTodos?: Todo[]
}

interface Todo {
  id: string
  title: string
  description: string | null
  completed: boolean
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  membershipId: string
  membership: {
    id: string
    user: {
      id: string
      name: string | null
      email: string
      image: string | null
    }
    team: {
      id: string
      name: string
    } | null
  }
}

interface TeamMember {
  id: string
  role: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  team: {
    id: string
    name: string
  } | null
}

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Circle },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: Flag },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: AlertTriangle },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: AlertTriangle },
}

export function TodoTab({ clubId, currentMembershipId, user, isAdmin, initialTodos }: TodoTabProps) {
  const { toast } = useToast()
  const [todos, setTodos] = useState<Todo[]>(initialTodos || [])
  const [allTodos, setAllTodos] = useState<Todo[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(!initialTodos)
  const [submitting, setSubmitting] = useState(false)
  
  // Filter state
  const [showCompleted, setShowCompleted] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all')
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    dueDate: '',
    membershipId: '',
  })

  const fetchTodos = useCallback(async () => {
    try {
      const showAll = viewMode === 'all' && isAdmin
      const params = new URLSearchParams({ clubId })
      if (showAll) {
        params.append('showAll', 'true')
        if (selectedMemberId !== 'all') {
          params.append('membershipId', selectedMemberId)
        }
      }
      
      const response = await fetch(`/api/todos?${params}`)
      if (!response.ok) throw new Error('Failed to fetch todos')
      const data = await response.json()
      
      if (showAll) {
        setAllTodos(data.todos || [])
      } else {
        setTodos(data.todos || [])
      }
    } catch (error) {
      console.error('Failed to fetch todos:', error)
      toast({
        title: 'Error',
        description: 'Failed to load todos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [clubId, viewMode, selectedMemberId, isAdmin, toast])

  const fetchTeamMembers = useCallback(async () => {
    if (!isAdmin) return
    try {
      const response = await fetch(`/api/clubs/${clubId}/teams`)
      if (!response.ok) return
      // We need to fetch memberships separately
      const membersResponse = await fetch(`/api/memberships?clubId=${clubId}`)
      if (membersResponse.ok) {
        const data = await membersResponse.json()
        setTeamMembers(data.memberships || [])
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error)
    }
  }, [clubId, isAdmin])

  useEffect(() => {
    // If we have initial todos and are in 'my' view mode, skip fetching
    if (initialTodos && viewMode === 'my' && !isAdmin) {
      setLoading(false)
      if (isAdmin) {
        fetchTeamMembers()
      }
      return
    }
    // Fetch todos and team members in parallel
    Promise.all([
      fetchTodos(),
      isAdmin ? fetchTeamMembers() : Promise.resolve()
    ])
  }, [fetchTodos, fetchTeamMembers, isAdmin, initialTodos, viewMode])

  const handleCreateTodo = async () => {
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          title: formData.title,
          description: formData.description || undefined,
          priority: formData.priority,
          dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
          membershipId: formData.membershipId || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create todo')
      }

      toast({
        title: 'Todo created',
        description: 'Your todo has been added',
      })

      setCreateDialogOpen(false)
      resetForm()
      fetchTodos()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create todo'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateTodo = async () => {
    if (!selectedTodo || !formData.title.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/todos/${selectedTodo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          priority: formData.priority,
          dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update todo')
      }

      toast({
        title: 'Todo updated',
        description: 'Your changes have been saved',
      })

      setEditDialogOpen(false)
      setSelectedTodo(null)
      resetForm()
      fetchTodos()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update todo'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleComplete = async (todo: Todo) => {
    // Optimistic update - update immediately
    const newCompleted = !todo.completed
    
    setTodos(prev =>
      prev.map(t =>
        t.id === todo.id
          ? { ...t, completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : null }
          : t
      )
    )
    setAllTodos(prev =>
      prev.map(t =>
        t.id === todo.id
          ? { ...t, completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : null }
          : t
      )
    )

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      })

      if (!response.ok) {
        throw new Error('Failed to update todo')
      }
    } catch (error) {
      // Revert on error by refetching
      toast({
        title: 'Error',
        description: 'Failed to update todo',
        variant: 'destructive',
      })
      fetchTodos()
    }
  }

  const handleDeleteTodo = async () => {
    if (!selectedTodo) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/todos/${selectedTodo.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete todo')

      toast({
        title: 'Todo deleted',
        description: 'The todo has been removed',
      })

      setDeleteDialogOpen(false)
      setSelectedTodo(null)
      fetchTodos()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete todo',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
      membershipId: '',
    })
  }

  const openEditDialog = (todo: Todo) => {
    setSelectedTodo(todo)
    setFormData({
      title: todo.title,
      description: todo.description || '',
      priority: todo.priority,
      dueDate: todo.dueDate ? todo.dueDate.split('T')[0] : '',
      membershipId: todo.membershipId,
    })
    setEditDialogOpen(true)
  }

  const getFilteredTodos = (todoList: Todo[]) => {
    return todoList.filter(todo => {
      if (!showCompleted && todo.completed) return false
      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) return false
      return true
    })
  }

  const getDueDateDisplay = (dueDate: string | null) => {
    if (!dueDate) return null
    const date = new Date(dueDate)
    if (isToday(date)) return { text: 'Today', color: 'text-orange-600 dark:text-orange-400' }
    if (isTomorrow(date)) return { text: 'Tomorrow', color: 'text-blue-600 dark:text-blue-400' }
    if (isPast(date)) return { text: format(date, 'MMM d'), color: 'text-red-600 dark:text-red-400' }
    return { text: format(date, 'MMM d'), color: 'text-muted-foreground' }
  }

  const currentTodos = viewMode === 'all' ? allTodos : todos
  const filteredTodos = getFilteredTodos(currentTodos)
  const incompleteTodos = filteredTodos.filter(t => !t.completed)
  const completedTodos = filteredTodos.filter(t => t.completed)

  if (loading) {
    return (
      <PageLoading
        title="Loading tasks"
        description="Fetching your to-do list..."
        variant="orbit"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">To-Do List</h2>
          <p className="text-muted-foreground">
            {viewMode === 'my' 
              ? `You have ${incompleteTodos.length} task${incompleteTodos.length !== 1 ? 's' : ''} remaining`
              : `${incompleteTodos.length} task${incompleteTodos.length !== 1 ? 's' : ''} across all members`
            }
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
            {isAdmin && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'my' | 'all')} className="w-full sm:w-auto">
                <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-grid">
                  <TabsTrigger value="my" className="text-xs sm:text-sm">My Tasks</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs sm:text-sm">
                    <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    All Tasks
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {viewMode === 'all' && isAdmin && (
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Filter by member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.user.name || member.user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs sm:text-sm">
                <Filter className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2 py-1">
              <Checkbox
                id="show-completed"
                checked={showCompleted}
                onCheckedChange={(checked) => setShowCompleted(checked as boolean)}
                className="h-5 w-5 sm:h-4 sm:w-4"
              />
              <Label htmlFor="show-completed" className="text-xs sm:text-sm cursor-pointer">
                Show completed
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {showCompleted ? 'No tasks found' : 'All caught up!'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {showCompleted 
                ? 'No tasks match your current filters.'
                : 'You have no pending tasks. Add a new one to get started.'
              }
            </p>
            <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Incomplete todos */}
          {incompleteTodos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              showOwner={viewMode === 'all'}
              currentMembershipId={currentMembershipId}
              isAdmin={isAdmin}
              onToggle={() => handleToggleComplete(todo)}
              onEdit={() => openEditDialog(todo)}
              onDelete={() => {
                setSelectedTodo(todo)
                setDeleteDialogOpen(true)
              }}
            />
          ))}

          {/* Completed todos (if showing) */}
          {showCompleted && completedTodos.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground font-medium">
                  Completed ({completedTodos.length})
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {completedTodos.map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  showOwner={viewMode === 'all'}
                  currentMembershipId={currentMembershipId}
                  isAdmin={isAdmin}
                  onToggle={() => handleToggleComplete(todo)}
                  onEdit={() => openEditDialog(todo)}
                  onDelete={() => {
                    setSelectedTodo(todo)
                    setDeleteDialogOpen(true)
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Create Todo Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Create a new task to track your progress.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="What needs to be done?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add more details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v as typeof formData.priority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="assignee">Assign To</Label>
                <Select
                  value={formData.membershipId || 'myself'}
                  onValueChange={(v) => setFormData({ ...formData, membershipId: v === 'myself' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Myself" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="myself">Myself</SelectItem>
                    {teamMembers
                      .filter(m => m.id !== currentMembershipId)
                      .map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.user.name || member.user.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTodo} disabled={submitting || !formData.title.trim()}>
              {submitting && <ButtonLoading />}
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Todo Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update your task details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                placeholder="What needs to be done?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Add more details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v as typeof formData.priority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dueDate">Due Date</Label>
                <Input
                  id="edit-dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setSelectedTodo(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTodo} disabled={submitting || !formData.title.trim()}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedTodo && (
            <div className="py-4">
              <p className="font-medium">{selectedTodo.title}</p>
              {selectedTodo.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedTodo.description}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setSelectedTodo(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTodo} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Todo Item Component
function TodoItem({
  todo,
  showOwner,
  currentMembershipId,
  isAdmin,
  onToggle,
  onEdit,
  onDelete,
}: {
  todo: Todo
  showOwner: boolean
  currentMembershipId: string
  isAdmin: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const priorityConfig = PRIORITY_CONFIG[todo.priority]
  const PriorityIcon = priorityConfig.icon
  const canEdit = todo.membershipId === currentMembershipId || isAdmin
  
  const getDueDateDisplay = (dueDate: string | null) => {
    if (!dueDate) return null
    const date = new Date(dueDate)
    if (isToday(date)) return { text: 'Today', color: 'text-orange-600 dark:text-orange-400' }
    if (isTomorrow(date)) return { text: 'Tomorrow', color: 'text-blue-600 dark:text-blue-400' }
    if (isPast(date) && !todo.completed) return { text: format(date, 'MMM d'), color: 'text-red-600 dark:text-red-400' }
    return { text: format(date, 'MMM d'), color: 'text-muted-foreground' }
  }

  const dueDateInfo = getDueDateDisplay(todo.dueDate)

  return (
    <Card className={`transition-all hover:shadow-md ${todo.completed ? 'opacity-60' : ''}`}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggle}
            className="mt-0.5 flex-shrink-0 focus:outline-none"
          >
            {todo.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {todo.title}
                </p>
                {todo.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {todo.description}
                  </p>
                )}
              </div>
              
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" className={priorityConfig.color}>
                <PriorityIcon className="mr-1 h-3 w-3" />
                {priorityConfig.label}
              </Badge>
              
              {dueDateInfo && (
                <span className={`text-xs flex items-center gap-1 ${dueDateInfo.color}`}>
                  <Clock className="h-3 w-3" />
                  {dueDateInfo.text}
                </span>
              )}
              
              {showOwner && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={todo.membership.user.image || undefined} />
                    <AvatarFallback className="text-[8px]">
                      {(todo.membership.user.name || todo.membership.user.email)[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{todo.membership.user.name || todo.membership.user.email}</span>
                </div>
              )}
              
              {todo.completed && todo.completedAt && (
                <span className="text-xs text-muted-foreground">
                  Completed {format(new Date(todo.completedAt), 'MMM d')}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

