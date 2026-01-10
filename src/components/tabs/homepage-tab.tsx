'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { 
  Plus, 
  Settings, 
  Eye, 
  EyeOff, 
  Trash2, 
  GripVertical,
  Edit,
  Check
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  rectIntersection,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { PageLoading } from '@/components/ui/loading-spinner'

// Import all widget components
import { WelcomeWidget } from '@/components/widgets/welcome-widget'
import { RecentAnnouncementsWidget } from '@/components/widgets/recent-announcements-widget'
import { UpcomingEventsWidget } from '@/components/widgets/upcoming-events-widget'
import { TeamStatsWidget } from '@/components/widgets/team-stats-widget'
import { QuickActionsWidget } from '@/components/widgets/quick-actions-widget'
import { UpcomingTestsWidget } from '@/components/widgets/upcoming-tests-widget'
import { CustomTextWidget } from '@/components/widgets/custom-text-widget'
import { ImportantLinksWidget } from '@/components/widgets/important-links-widget'

interface HomePageTabProps {
  clubId: string
  club: any
  isAdmin: boolean
  user: any
  initialEvents?: any[]
  initialAnnouncements?: any[]
  initialTests?: any[]
}

// Sortable Widget Item Component
function SortableWidgetItem({
  widget,
  isConfigMode,
  getWidgetClassName,
  renderWidget,
  toggleVisibility,
  setSelectedWidget,
  setEditWidgetOpen,
  handleDeleteWidget,
}: {
  widget: any
  isConfigMode: boolean
  getWidgetClassName: (widget: any) => string
  renderWidget: (widget: any) => React.ReactNode
  toggleVisibility: (widget: any) => void
  setSelectedWidget: (widget: any) => void
  setEditWidgetOpen: (open: boolean) => void
  handleDeleteWidget: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isConfigMode })

  // Only apply translation, no scaling or rotation
  const transformString = transform
    ? `translate3d(${Math.round(transform.x || 0)}px, ${Math.round(transform.y || 0)}px, 0)`
    : undefined

  const style = {
    transform: transformString,
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
    willChange: isDragging ? 'transform' : 'auto',
    // Lock dimensions to prevent distortion during drag
    minWidth: '100%',
    maxWidth: '100%',
    width: '100%',
    // Prevent any scaling or skewing
    scale: 'none',
    rotate: 'none',
    // Ensure proper rendering
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden',
  } as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${getWidgetClassName(widget)} ${isDragging ? 'z-50 pointer-events-none' : ''}`}
      // Prevent layout shifts and distortion
      data-sortable-item
    >
      {isConfigMode && (
        <>
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="absolute top-2 right-2 z-10 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => toggleVisibility(widget)}
              className="h-8 w-8 p-0"
            >
              {widget.isVisible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedWidget(widget)
                setEditWidgetOpen(true)
              }}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDeleteWidget(widget.id)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
      {widget.isVisible ? (
        <div className="widget-content-wrapper" style={{ 
          width: '100%', 
          // Lock dimensions
          minWidth: '100%',
          maxWidth: '100%',
        }}>
          {renderWidget(widget)}
        </div>
      ) : (
        <div className="h-full border-2 border-dashed border-border rounded-lg flex items-center justify-center p-6 bg-muted">
          <p className="text-sm text-muted-foreground">
            Hidden Widget
          </p>
        </div>
      )}
    </div>
  )
}

export function HomePageTab({ clubId, club, isAdmin, user, initialEvents, initialAnnouncements, initialTests }: HomePageTabProps) {
  const { toast } = useToast()
  const [widgets, setWidgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isConfigMode, setIsConfigMode] = useState(false)
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)
  const [editWidgetOpen, setEditWidgetOpen] = useState(false)
  const [selectedWidget, setSelectedWidget] = useState<any>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  
  // Data for widgets - use initial data if provided
  const [announcements, setAnnouncements] = useState<any[]>(initialAnnouncements || [])
  const [events, setEvents] = useState<any[]>(initialEvents || [])
  const [tests, setTests] = useState<any[]>(initialTests || [])
  const [stats, setStats] = useState({
    memberCount: club.memberships?.length || 0,
    announcementCount: initialAnnouncements?.length || 0,
    eventCount: initialEvents?.length || 0,
    testCount: initialTests?.length || 0,
  })

  const canConfigureWidgets = isAdmin

  useEffect(() => {
    if (!user?.id) return
    // Fetch widgets and data in parallel if needed
    const promises: Promise<void>[] = [fetchWidgets()]
    // Only fetch data if we don't have all initial data
    if (!initialAnnouncements || !initialEvents || !initialTests) {
      promises.push(fetchData())
    }
    Promise.all(promises)
  }, [clubId, user?.id, initialAnnouncements, initialEvents, initialTests])

  // Calculate stats when data changes
  useEffect(() => {
    setStats({
      memberCount: club.memberships?.length || 0,
      announcementCount: announcements.length,
      eventCount: events.length,
      testCount: tests.length,
    })
  }, [announcements.length, events.length, tests.length, club.memberships?.length])

  const fetchWidgets = async () => {
    try {
      const response = await fetch(`/api/widgets?clubId=${clubId}`)
      if (!response.ok) throw new Error('Failed to fetch widgets')
      const data = await response.json()
      setWidgets(data.widgets || [])
    } catch (error) {
      console.error('Failed to fetch widgets:', error)
      toast({
        title: 'Error',
        description: 'Failed to load widgets',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      // Batch fetch all missing data in parallel
      const promises: Promise<void>[] = []
      
      if (!initialAnnouncements) {
        promises.push(
          fetch(`/api/announcements?clubId=${clubId}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => data && setAnnouncements(data.announcements || []))
            .catch(err => console.error('Failed to fetch announcements:', err))
        )
      }

      if (!initialEvents) {
        promises.push(
          fetch(`/api/calendar?clubId=${clubId}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => data && setEvents(data.events || []))
            .catch(err => console.error('Failed to fetch events:', err))
        )
      }

      if (!initialTests) {
        promises.push(
          fetch(`/api/tests?clubId=${clubId}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => data && setTests(data.tests || []))
            .catch(err => console.error('Failed to fetch tests:', err))
        )
      }

      await Promise.all(promises)

      // Calculate stats - use current state values
      setStats(prev => ({
        memberCount: club.memberships?.length || 0,
        announcementCount: announcements.length,
        eventCount: events.length,
        testCount: tests.length,
      }))
    } catch (error) {
      console.error('Failed to fetch widget data:', error)
    }
  }

  const handleAddWidget = async (widgetData: any) => {
    try {
      // Set position to the end of the list
      const newPosition = widgets.length

      const response = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          ...widgetData,
          position: newPosition,
        }),
      })

      if (!response.ok) throw new Error('Failed to add widget')

      toast({
        title: 'Widget added',
        description: 'Your widget has been added successfully',
      })

      fetchWidgets()
      setAddWidgetOpen(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add widget',
        variant: 'destructive',
      })
    }
  }

  const handleUpdateWidget = async (widgetId: string, updates: any) => {
    try {
      const response = await fetch(`/api/widgets/${widgetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update widget')

      toast({
        title: 'Widget updated',
        description: 'Your widget has been updated successfully',
      })

      fetchWidgets()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update widget',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteWidget = async (widgetId: string) => {
    try {
      const response = await fetch(`/api/widgets/${widgetId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete widget')

      toast({
        title: 'Widget deleted',
        description: 'Your widget has been deleted successfully',
      })

      fetchWidgets()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete widget',
        variant: 'destructive',
      })
    }
  }

  const toggleVisibility = async (widget: any) => {
    await handleUpdateWidget(widget.id, { isVisible: !widget.isVisible })
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    // Prevent sidebar from interfering with drag
    document.body.style.pointerEvents = 'auto'
    const sidebar = document.querySelector('aside')
    if (sidebar) {
      sidebar.style.pointerEvents = 'none'
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    
    // Restore sidebar pointer events
    const sidebar = document.querySelector('aside')
    if (sidebar) {
      sidebar.style.pointerEvents = 'auto'
    }

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = visibleWidgets.findIndex((w) => w.id === active.id)
    const newIndex = visibleWidgets.findIndex((w) => w.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Reorder visible widgets
    const reorderedVisibleWidgets = arrayMove(visibleWidgets, oldIndex, newIndex)
    
    // Optimistically update the UI - assign sequential positions to visible widgets
    setWidgets((prev) => {
      const updated = [...prev]
      
      // Update visible widgets' positions to be sequential (0, 1, 2, ...)
      reorderedVisibleWidgets.forEach((widget, index) => {
        const widgetInArray = updated.find((w) => w.id === widget.id)
        if (widgetInArray) {
          widgetInArray.position = index
        }
      })
      
      // Keep hidden widgets' positions but offset them after visible ones
      const hiddenWidgets = updated.filter((w) => !w.isVisible && !isConfigMode)
      hiddenWidgets.forEach((widget) => {
        const currentPosition = widget.position ?? 0
        if (currentPosition < reorderedVisibleWidgets.length) {
          widget.position = reorderedVisibleWidgets.length + currentPosition
        }
      })
      
      return updated.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    })

    // Update positions in the backend
    try {
      // Update visible widgets with sequential positions
      const visibleUpdates = reorderedVisibleWidgets.map((widget, index) => ({
        id: widget.id,
        position: index,
      }))

      // Update all visible widgets' positions
      await Promise.all(
        visibleUpdates.map((update) =>
          handleUpdateWidget(update.id, { position: update.position })
        )
      )
    } catch (error) {
      // Revert on error
      fetchWidgets()
      toast({
        title: 'Error',
        description: 'Failed to update widget order',
        variant: 'destructive',
      })
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const renderWidget = (widget: any) => {
    const widgetProps = {
      config: widget.config,
    }

    switch (widget.widgetType) {
      case 'WELCOME_MESSAGE':
        return (
          <WelcomeWidget
            clubName={club.name}
            memberCount={club.memberships?.length || 0}
            {...widgetProps}
          />
        )
      case 'RECENT_ANNOUNCEMENTS':
        return (
          <RecentAnnouncementsWidget
            announcements={announcements}
            clubId={clubId}
            {...widgetProps}
          />
        )
      case 'UPCOMING_EVENTS':
        return (
          <UpcomingEventsWidget
            events={events}
            clubId={clubId}
            {...widgetProps}
          />
        )
      case 'TEAM_STATS':
        return <TeamStatsWidget stats={stats} {...widgetProps} />
      case 'QUICK_ACTIONS':
        return (
          <QuickActionsWidget
            clubId={clubId}
            isAdmin={isAdmin}
            {...widgetProps}
          />
        )
      case 'UPCOMING_TESTS':
        return (
          <UpcomingTestsWidget
            tests={tests}
            clubId={clubId}
            {...widgetProps}
          />
        )
      case 'CUSTOM_TEXT':
        return <CustomTextWidget {...widgetProps} />
      case 'IMPORTANT_LINKS':
        return <ImportantLinksWidget {...widgetProps} />
      default:
        return <div>Unknown widget type</div>
    }
  }

  const getWidgetClassName = (widget: { width?: string; height?: string }) => {
    const widthClasses: Record<string, string> = {
      SMALL: 'col-span-1',
      MEDIUM: 'col-span-1 md:col-span-2',
      LARGE: 'col-span-1 md:col-span-3',
      FULL: 'col-span-1 md:col-span-4',
    }

    const heightClasses: Record<string, string> = {
      SMALL: 'row-span-1',
      MEDIUM: 'row-span-1',
      LARGE: 'row-span-2',
      AUTO: 'row-span-auto',
    }

    const widthKey = widget.width && widget.width in widthClasses ? widget.width : 'MEDIUM'
    const heightKey = widget.height && widget.height in heightClasses ? widget.height : 'MEDIUM'

    return `${widthClasses[widthKey]} ${heightClasses[heightKey]}`
  }

  const visibleWidgets = widgets.filter(w => w.isVisible || isConfigMode)

  if (loading) {
    return (
      <PageLoading
        title="Loading your dashboard"
        description="Setting up your personalized widgets..."
        variant="orbit"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold truncate">Home</h2>
          <p className="text-sm sm:text-base text-muted-foreground truncate">
            Welcome back to {club.name}
          </p>
        </div>
        {canConfigureWidgets && (
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant={isConfigMode ? 'default' : 'outline'}
              onClick={() => setIsConfigMode(!isConfigMode)}
              size="sm"
              className="text-xs sm:text-sm"
            >
              {isConfigMode ? (
                <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              ) : (
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              )}
              <span className="hidden sm:inline">{isConfigMode ? 'Done' : 'Configure'}</span>
              <span className="sm:hidden">{isConfigMode ? 'Done' : 'Config'}</span>
            </Button>
            {isConfigMode && (
              <Button onClick={() => setAddWidgetOpen(true)} size="sm" className="text-xs sm:text-sm">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Add Widget</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Widgets Grid */}
      {visibleWidgets.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <p className="text-muted-foreground mb-4 px-4">
            No widgets configured yet
          </p>
          {canConfigureWidgets && (
            <Button onClick={() => setAddWidgetOpen(true)} size="sm" className="text-xs sm:text-sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Your First Widget</span>
              <span className="sm:hidden">Add Widget</span>
            </Button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleWidgets.map((w) => w.id)}
            strategy={rectSortingStrategy}
          >
            <div 
              ref={gridContainerRef}
              className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-auto"
              style={{ 
                position: 'relative',
                // Prevent layout shifts during drag
                minHeight: '100px',
                // Ensure grid items maintain their size
                gridAutoRows: 'min-content',
                // Prevent grid from recalculating during drag
                contain: 'layout',
              }}
            >
              {visibleWidgets.map((widget) => (
                <SortableWidgetItem
                  key={widget.id}
                  widget={widget}
                  isConfigMode={isConfigMode}
                  getWidgetClassName={getWidgetClassName}
                  renderWidget={renderWidget}
                  toggleVisibility={toggleVisibility}
                  setSelectedWidget={setSelectedWidget}
                  setEditWidgetOpen={setEditWidgetOpen}
                  handleDeleteWidget={handleDeleteWidget}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay
            style={{
              cursor: 'grabbing',
              zIndex: 9999,
            }}
            dropAnimation={null}
          >
            {activeId ? (
              <div 
                className="shadow-2xl"
                style={{
                  pointerEvents: 'none',
                  width: '100%',
                  maxWidth: '100%',
                }}
              >
                {(() => {
                  const widget = visibleWidgets.find(w => w.id === activeId)
                  if (!widget) return null
                  return (
                    <div 
                      className={getWidgetClassName(widget)}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        transform: 'none', // Prevent any transform distortion
                      }}
                    >
                      {renderWidget(widget)}
                    </div>
                  )
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={addWidgetOpen}
        onOpenChange={setAddWidgetOpen}
        onAdd={handleAddWidget}
      />

      {/* Edit Widget Dialog */}
      {selectedWidget && (
        <EditWidgetDialog
          open={editWidgetOpen}
          onOpenChange={setEditWidgetOpen}
          widget={selectedWidget}
          onUpdate={(updates: Record<string, unknown>) => {
            handleUpdateWidget(selectedWidget.id, updates)
            setEditWidgetOpen(false)
          }}
        />
      )}
    </div>
  )
}

// Add Widget Dialog Component
function AddWidgetDialog({ open, onOpenChange, onAdd }: any) {
  const [widgetType, setWidgetType] = useState('')
  const [title, setTitle] = useState('')
  const [width, setWidth] = useState('MEDIUM')
  const [height, setHeight] = useState('MEDIUM')

  const widgetTypes = [
    { value: 'WELCOME_MESSAGE', label: 'Welcome Message' },
    { value: 'RECENT_ANNOUNCEMENTS', label: 'Recent Announcements' },
    { value: 'UPCOMING_EVENTS', label: 'Upcoming Events' },
    { value: 'TEAM_STATS', label: 'Team Stats' },
    { value: 'QUICK_ACTIONS', label: 'Quick Actions' },
    { value: 'UPCOMING_TESTS', label: 'Upcoming Tests' },
    { value: 'CUSTOM_TEXT', label: 'Custom Text' },
    { value: 'IMPORTANT_LINKS', label: 'Important Links' },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!widgetType) return

    onAdd({
      widgetType,
      title: title || undefined,
      width,
      height,
      config: {},
    })

    // Reset form
    setWidgetType('')
    setTitle('')
    setWidth('MEDIUM')
    setHeight('MEDIUM')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>
              Choose a widget type and configure it for your homepage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="widgetType">Widget Type</Label>
              <Select value={widgetType} onValueChange={setWidgetType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a widget type" />
                </SelectTrigger>
                <SelectContent>
                  {widgetTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="title">Custom Title (Optional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leave empty for default title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="width">Width</Label>
                <Select value={width} onValueChange={setWidth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">Small</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LARGE">Large</SelectItem>
                    <SelectItem value="FULL">Full Width</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="height">Height</Label>
                <Select value={height} onValueChange={setHeight}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">Small</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LARGE">Large</SelectItem>
                    <SelectItem value="AUTO">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!widgetType}>
              Add Widget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Edit Widget Dialog Component
function EditWidgetDialog({ open, onOpenChange, widget, onUpdate }: any) {
  const [title, setTitle] = useState(widget.title || '')
  const [width, setWidth] = useState(widget.width)
  const [height, setHeight] = useState(widget.height)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate({
      title: title || undefined,
      width,
      height,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Widget</DialogTitle>
            <DialogDescription>
              Update the widget configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-title">Custom Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leave empty for default title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-width">Width</Label>
                <Select value={width} onValueChange={setWidth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">Small</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LARGE">Large</SelectItem>
                    <SelectItem value="FULL">Full Width</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-height">Height</Label>
                <Select value={height} onValueChange={setHeight}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">Small</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LARGE">Large</SelectItem>
                    <SelectItem value="AUTO">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              Update Widget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

