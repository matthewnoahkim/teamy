'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Palette, Save, Plus, X, GripVertical, Upload, Image as ImageIcon, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type BackgroundOption = 'grid' | 'solid' | 'gradient' | 'image'

interface CustomizationClientProps {
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  preferences: Record<string, unknown> | null
}

// Circular Gradient Direction Picker Component
function GradientDirectionPicker({
  angle,
  onChange,
}: {
  angle: number
  onChange: (angle: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const size = 120
  const radius = size / 2 - 12
  const center = size / 2

  const radians = ((angle - 90) * Math.PI) / 180
  const x = center + radius * Math.cos(radians)
  const y = center + radius * Math.sin(radians)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    updateAngle(e)
  }

  const updateAngle = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const deltaX = e.clientX - centerX
    const deltaY = e.clientY - centerY

    let newAngle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90

    if (newAngle < 0) newAngle += 360
    if (newAngle >= 360) newAngle -= 360

    onChange(Math.round(newAngle))
  }, [onChange])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      updateAngle(e)
    }
  }, [isDragging, updateAngle])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={containerRef}
        className="relative cursor-pointer touch-none"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 rounded-full bg-muted/30 border border-border/50" />
        <div
          className="absolute inset-2 rounded-full bg-card border border-border/30"
          style={{ boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)' }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full h-px bg-border/30 absolute top-1/2 left-0" />
          <div className="w-px h-full bg-border/30 absolute left-1/2 top-0" />
        </div>
        <div
          className="absolute left-1/2 top-1/2 origin-bottom pointer-events-none"
          style={{
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            width: '2px',
            height: `${radius - 4}px`,
            background: `linear-gradient(to bottom, hsl(var(--primary) / 0.6), transparent)`,
          }}
        />
        <div
          className="absolute rounded-full cursor-grab active:cursor-grabbing z-10 transition-all duration-200 hover:scale-125 active:scale-110"
          style={{
            left: x - 10,
            top: y - 10,
            width: '20px',
            height: '20px',
            background: 'hsl(var(--primary))',
            border: '3px solid hsl(var(--background))',
            boxShadow: `0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px hsl(var(--primary) / 0.3)`,
          }}
        >
          <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
        </div>
      </div>
      <div className="text-sm font-semibold text-foreground">{angle}°</div>
    </div>
  )
}

// Sortable Color Item Component
function SortableColorItem({
  color,
  index,
  totalColors,
  onUpdate,
  onRemove,
}: {
  color: string
  index: number
  totalColors: number
  onUpdate: (color: string) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} className="space-y-2 w-full">
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Label htmlFor={`gradient-color-${index}`} className="text-sm min-w-[80px]">
          {index === 0 ? 'Start' : index === totalColors - 1 ? 'End' : `Color ${index + 1}`}
        </Label>
        {totalColors > 2 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Input
          id={`gradient-color-${index}`}
          type="color"
          value={color}
          onChange={(e) => onUpdate(e.target.value)}
          className="w-20 h-12 cursor-pointer"
        />
        <Input
          type="text"
          value={color}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="#e0e7ff"
          className="flex-1"
        />
      </div>
    </div>
  )
}

export function CustomizationClient({ user, preferences }: CustomizationClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Determine back destination based on where user came from
  const from = searchParams.get('from')
  const backHref = '/dashboard'

  const defaultColors = {
    backgroundColor: '#f8fafc',
    gradientStartColor: '#e0e7ff',
    gradientEndColor: '#fce7f3',
  }

  // Background state
  const [backgroundType, setBackgroundType] = useState<BackgroundOption>(
    (preferences?.backgroundType as BackgroundOption) || 'grid'
  )
  const [backgroundColor, setBackgroundColor] = useState<string>(
    (preferences?.backgroundColor as string) || defaultColors.backgroundColor
  )
  const [gradientColors, setGradientColors] = useState<string[]>(() => {
    const prefColors = preferences?.gradientColors as string[] | undefined
    if (prefColors && prefColors.length > 0) {
      return prefColors
    }
    return [defaultColors.gradientStartColor, defaultColors.gradientEndColor]
  })
  const [gradientDirection, setGradientDirection] = useState<number>(() => {
    const dir = preferences?.gradientDirection as string | undefined
    if (dir) {
      const match = dir.match(/(\d+)/)
      return match ? parseInt(match[1]) : 135
    }
    return 135
  })
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    (preferences?.backgroundImageUrl as string) || null
  )
  const [savingBackground, setSavingBackground] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const addGradientColor = () => {
    setGradientColors([...gradientColors, '#ffffff'])
  }

  const removeGradientColor = (index: number) => {
    if (gradientColors.length > 2) {
      setGradientColors(gradientColors.filter((_, i) => i !== index))
    }
  }

  const updateGradientColor = (index: number, color: string) => {
    const newColors = [...gradientColors]
    newColors[index] = color
    setGradientColors(newColors)
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setGradientColors((items) => {
        const oldIndex = active.id as number
        const newIndex = over.id as number
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const validateImageFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a JPEG, PNG, WebP, or GIF image'
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'Image must be less than 10MB'
    }
    return null
  }

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    try {
      const validationError = validateImageFile(file)
      if (validationError) {
        toast({ title: 'Invalid file', description: validationError, variant: 'destructive' })
        setUploadingImage(false)
        return
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/user/preferences/background-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload image')
      }

      const data = await response.json()
      setBackgroundImageUrl(data.backgroundImageUrl)
      setBackgroundType('image')

      toast({ title: 'Image uploaded', description: 'Background image has been uploaded successfully' })
      
      // Dispatch event to update background immediately
      window.dispatchEvent(new Event('userBackgroundUpdated'))
      
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to upload image', variant: 'destructive' })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteImage = async () => {
    setUploadingImage(true)
    try {
      const response = await fetch('/api/user/preferences/background-image', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete image')
      }

      setBackgroundImageUrl(null)
      setBackgroundType('grid')

      toast({ title: 'Image deleted', description: 'Background image has been removed' })
      
      // Dispatch event to update background immediately
      window.dispatchEvent(new Event('userBackgroundUpdated'))
      
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete image', variant: 'destructive' })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (backgroundType === 'image') {
      setIsDraggingImage(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingImage(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingImage(false)

    if (backgroundType !== 'image' || uploadingImage) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    handleImageUpload(files[0])
  }

  const handleSaveBackground = async () => {
    setSavingBackground(true)

    try {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
      if (backgroundType === 'solid' && backgroundColor && !hexColorRegex.test(backgroundColor)) {
        toast({ title: 'Invalid color', description: 'Please enter a valid hex color (e.g., #ffffff)', variant: 'destructive' })
        setSavingBackground(false)
        return
      }
      if (backgroundType === 'gradient') {
        if (gradientColors.length < 2) {
          toast({ title: 'Invalid gradient', description: 'At least two colors are required', variant: 'destructive' })
          setSavingBackground(false)
          return
        }
        for (let i = 0; i < gradientColors.length; i++) {
          if (!gradientColors[i] || !hexColorRegex.test(gradientColors[i])) {
            toast({ title: 'Invalid color', description: `Please enter a valid hex color for color ${i + 1}`, variant: 'destructive' })
            setSavingBackground(false)
            return
          }
        }
      }
      if (backgroundType === 'image' && !backgroundImageUrl) {
        toast({ title: 'Upload required', description: 'Please upload an image before saving.', variant: 'destructive' })
        setSavingBackground(false)
        return
      }

      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backgroundType,
          backgroundColor,
          gradientColors: backgroundType === 'gradient' ? gradientColors : undefined,
          gradientDirection: backgroundType === 'gradient' ? `${gradientDirection}deg` : undefined,
          backgroundImageUrl,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update background')
      }

      toast({ title: 'Background updated', description: 'Your background has been updated across the entire site' })
      
      // Dispatch event to update background immediately
      window.dispatchEvent(new Event('userBackgroundUpdated'))
      
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update background', variant: 'destructive' })
    } finally {
      setSavingBackground(false)
    }
  }

  const renderBackgroundControls = () => {
    if (backgroundType === 'solid') {
      return (
        <div className="space-y-2">
          <Label htmlFor="background-color">Background Color</Label>
          <div className="flex items-center gap-3">
            <Input
              id="background-color"
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="w-20 h-12 cursor-pointer"
            />
            <Input
              type="text"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              placeholder="#f8fafc"
              className="flex-1"
            />
          </div>
        </div>
      )
    }

    if (backgroundType === 'gradient') {
      return (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Gradient Colors</Label>
              <Button type="button" variant="outline" size="sm" onClick={addGradientColor} className="h-8">
                <Plus className="h-4 w-4 mr-1" />
                Add Color
              </Button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={gradientColors.map((_, index) => index)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {gradientColors.map((color, index) => (
                    <SortableColorItem
                      key={index}
                      color={color}
                      index={index}
                      totalColors={gradientColors.length}
                      onUpdate={(newColor) => updateGradientColor(index, newColor)}
                      onRemove={() => removeGradientColor(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="space-y-2">
              <Label>Gradient Direction</Label>
              <GradientDirectionPicker angle={gradientDirection} onChange={setGradientDirection} />
            </div>
          </div>
        </div>
      )
    }

    if (backgroundType === 'image') {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Background Image</Label>
            {backgroundImageUrl ? (
              <div className="space-y-3">
                <div
                  className={`relative h-32 rounded-lg border-2 overflow-hidden transition-colors ${
                    isDraggingImage ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <img src={backgroundImageUrl} alt="Background preview" className="w-full h-full object-cover" />
                  {isDraggingImage && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-primary mb-2" />
                        <p className="text-sm font-medium text-primary">Drop image to replace</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/gif'
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (file) handleImageUpload(file)
                      }
                      input.click()
                    }}
                    disabled={uploadingImage}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingImage ? 'Uploading...' : 'Replace Image'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteImage}
                    disabled={uploadingImage}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  className={`flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg transition-colors ${
                    isDraggingImage ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    <ImageIcon className={`mx-auto h-8 w-8 mb-2 transition-colors ${isDraggingImage ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className={`text-sm mb-2 transition-colors ${isDraggingImage ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                      {isDraggingImage ? 'Drop image here' : 'No image uploaded'}
                    </p>
                    {!isDraggingImage && <p className="text-xs text-muted-foreground">Drag and drop or click to upload</p>}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/gif'
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) handleImageUpload(file)
                    }
                    input.click()
                  }}
                  disabled={uploadingImage}
                  className="w-full"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                </Button>
                <p className="text-xs text-muted-foreground">Supported formats: JPEG, PNG, WebP, GIF (max 10MB)</p>
              </div>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  // Preview
  const previewBackground = () => {
    if (backgroundType === 'grid') {
      return 'linear-gradient(to right, #80808012 1px, transparent 1px), linear-gradient(to bottom, #80808012 1px, transparent 1px)'
    }
    if (backgroundType === 'solid') {
      return backgroundColor
    }
    if (backgroundType === 'gradient') {
      return `linear-gradient(${gradientDirection}deg, ${gradientColors.map((color, index) => 
        `${color} ${(index / (gradientColors.length - 1)) * 100}%`
      ).join(', ')})`
    }
    if (backgroundType === 'image' && backgroundImageUrl) {
      return `url(${backgroundImageUrl})`
    }
    return 'linear-gradient(to right, #80808012 1px, transparent 1px), linear-gradient(to bottom, #80808012 1px, transparent 1px)'
  }

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <AppHeader user={user} />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            href={backHref} 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="font-heading text-3xl font-bold text-foreground">Customization</h1>
          <p className="text-muted-foreground mt-2">Personalize your Teamy experience across the entire site</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Background
            </CardTitle>
            <CardDescription>
              Choose your background style. This applies to all pages including clubs, TD portal, and ES portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="background-type">Background Type</Label>
              <Select value={backgroundType} onValueChange={(value) => setBackgroundType(value as BackgroundOption)}>
                <SelectTrigger id="background-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid Pattern (Default)</SelectItem>
                  <SelectItem value="solid">Solid Color</SelectItem>
                  <SelectItem value="gradient">Gradient</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {renderBackgroundControls()}

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div
                className="h-32 rounded-lg border-2 border-border overflow-hidden"
                style={{
                  background: previewBackground(),
                  backgroundSize: backgroundType === 'grid' ? '24px 24px' : backgroundType === 'image' ? 'cover' : 'auto',
                  backgroundPosition: backgroundType === 'image' ? 'center' : 'auto',
                  backgroundRepeat: backgroundType === 'image' ? 'no-repeat' : 'repeat',
                }}
              />
            </div>

            <Button onClick={handleSaveBackground} disabled={savingBackground} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {savingBackground ? 'Saving...' : 'Save Background'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
