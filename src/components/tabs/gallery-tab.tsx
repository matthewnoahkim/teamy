'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { 
  Upload, 
  Image as ImageIcon, 
  Video, 
  Trash2,
  FolderPlus,
  Folder,
  X,
  Download,
  Edit,
  Calendar,
  User,
  Grid3x3,
  List
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateTime } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ButtonLoading, PageLoading } from '@/components/ui/loading-spinner'

interface GalleryTabProps {
  clubId: string
  user: any
  isAdmin: boolean
  initialMediaItems?: any[]
  initialAlbums?: any[]
}

export function GalleryTab({ clubId, user, isAdmin, initialMediaItems, initialAlbums }: GalleryTabProps) {
  const { toast } = useToast()
  const [mediaItems, setMediaItems] = useState<any[]>(initialMediaItems || [])
  const [albums, setAlbums] = useState<any[]>(initialAlbums || [])
  const [loading, setLoading] = useState(!(initialMediaItems && initialAlbums))
  const [uploading, setUploading] = useState(false)
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterType, setFilterType] = useState<'all' | 'images' | 'videos'>('all')
  
  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [createAlbumDialogOpen, setCreateAlbumDialogOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null)
  const [deleteMediaDialogOpen, setDeleteMediaDialogOpen] = useState(false)
  const [mediaToDelete, setMediaToDelete] = useState<string | null>(null)
  const [deletingMedia, setDeletingMedia] = useState(false)
  const [deleteAlbumDialogOpen, setDeleteAlbumDialogOpen] = useState(false)
  const [albumToDelete, setAlbumToDelete] = useState<string | null>(null)
  const [deletingAlbum, setDeletingAlbum] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Only fetch if we don't have initial data, or if filters changed
    if (!initialMediaItems || !initialAlbums || selectedAlbum || filterType !== 'all') {
      setLoading(true)
      // Batch fetch both in parallel
      Promise.all([fetchMedia(), fetchAlbums()]).finally(() => {
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [clubId, selectedAlbum, filterType, initialMediaItems, initialAlbums])

  const fetchMedia = async () => {
    try {
      let url = `/api/media?clubId=${clubId}`
      if (selectedAlbum) {
        url += `&albumId=${selectedAlbum}`
      }
      if (filterType === 'images') {
        url += `&mediaType=IMAGE`
      } else if (filterType === 'videos') {
        url += `&mediaType=VIDEO`
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch media')
      const data = await response.json()
      setMediaItems(data.mediaItems || [])
    } catch (error) {
      console.error('Failed to fetch media:', error)
      toast({
        title: 'Error',
        description: 'Failed to load media',
        variant: 'destructive',
      })
    }
  }

  const fetchAlbums = async () => {
    try {
      const response = await fetch(`/api/albums?clubId=${clubId}`)
      if (!response.ok) throw new Error('Failed to fetch albums')
      const data = await response.json()
      setAlbums(data.albums || [])
    } catch (error) {
      console.error('Failed to fetch albums:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('clubId', clubId)
        if (selectedAlbum) {
          formData.append('albumId', selectedAlbum)
        }

        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }
      }

      toast({
        title: 'Upload successful',
        description: `${files.length} file(s) uploaded successfully`,
      })

      fetchMedia()
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload files',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCreateAlbum = async (name: string, description: string) => {
    try {
      const response = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, name, description }),
      })

      if (!response.ok) throw new Error('Failed to create album')

      toast({
        title: 'Album created',
        description: `Album "${name}" created successfully`,
      })

      fetchAlbums()
      setCreateAlbumDialogOpen(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create album',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteMediaClick = (mediaId: string) => {
    setMediaToDelete(mediaId)
    setDeleteMediaDialogOpen(true)
  }

  const handleDeleteMedia = async () => {
    if (!mediaToDelete) return

    setDeletingMedia(true)
    try {
      const response = await fetch(`/api/media/${mediaToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete media')

      toast({
        title: 'Media deleted',
        description: 'Media deleted successfully',
      })

      fetchMedia()
      setViewerOpen(false)
      setDeleteMediaDialogOpen(false)
      setMediaToDelete(null)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete media',
        variant: 'destructive',
      })
    } finally {
      setDeletingMedia(false)
    }
  }

  const handleDeleteAlbumClick = (albumId: string) => {
    setAlbumToDelete(albumId)
    setDeleteAlbumDialogOpen(true)
  }

  const handleDeleteAlbum = async () => {
    if (!albumToDelete) return

    setDeletingAlbum(true)
    try {
      const response = await fetch(`/api/albums/${albumToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete album')

      toast({
        title: 'Album deleted',
        description: 'Album deleted successfully',
      })

      if (selectedAlbum === albumToDelete) {
        setSelectedAlbum(null)
      }
      fetchAlbums()
      setDeleteAlbumDialogOpen(false)
      setAlbumToDelete(null)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete album',
        variant: 'destructive',
      })
    } finally {
      setDeletingAlbum(false)
    }
  }

  const canDeleteMedia = (media: any) => {
    return media.uploadedById === user.id || isAdmin
  }

  const canDeleteAlbum = (album: any) => {
    return album.createdById === user.id || isAdmin
  }

  if (loading) {
    return (
      <PageLoading
        title="Loading gallery"
        description="Fetching your photos and albums..."
        variant="orbit"
      />
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold">Gallery</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Photos and videos from your team
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => setCreateAlbumDialogOpen(true)}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <FolderPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">New Album</span>
          </Button>
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            {uploading ? (
              <ButtonLoading className="sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">{uploading ? 'Uploading...' : 'Upload'}</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Albums Bar */}
      {albums.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedAlbum === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedAlbum(null)}
          >
            All Media
          </Button>
          {albums.map((album) => (
            <div key={album.id} className="relative group">
              <Button
                variant={selectedAlbum === album.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedAlbum(album.id)}
                className="pr-8"
              >
                <Folder className="h-4 w-4 mr-2" />
                {album.name} ({album._count.media})
              </Button>
              {canDeleteAlbum(album) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteAlbumClick(album.id)
                  }}
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex gap-2 flex-1 sm:flex-none">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className="flex-1 sm:flex-none text-xs sm:text-sm px-3"
          >
            All
          </Button>
          <Button
            variant={filterType === 'images' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('images')}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Images</span>
          </Button>
          <Button
            variant={filterType === 'videos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('videos')}
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <Video className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Videos</span>
          </Button>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Media Grid/List */}
      {mediaItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No media yet. Start by uploading some photos or videos!
            </p>
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Media
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaItems.map((media) => (
            <div
              key={media.id}
              className="relative group cursor-pointer aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
              onClick={() => {
                setSelectedMedia(media)
                setViewerOpen(true)
              }}
            >
              {media.mediaType === 'IMAGE' ? (
                <img
                  src={media.filePath}
                  alt={media.originalFilename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video
                    src={media.filePath}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="h-12 w-12 text-white" />
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end p-3">
                <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm">
                  <p className="font-semibold truncate">
                    {media.originalFilename}
                  </p>
                  <p className="text-xs">
                    by {media.uploadedBy.name || media.uploadedBy.email}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {mediaItems.map((media) => (
            <Card
              key={media.id}
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => {
                setSelectedMedia(media)
                setViewerOpen(true)
              }}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden flex-shrink-0">
                  {media.mediaType === 'IMAGE' ? (
                    <img
                      src={media.filePath}
                      alt={media.originalFilename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {media.originalFilename}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {media.uploadedBy.name || media.uploadedBy.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(media.createdAt)}
                    </span>
                    {media.album && (
                      <Badge variant="outline">{media.album.name}</Badge>
                    )}
                  </div>
                </div>
                <Badge variant="outline">
                  {media.mediaType === 'IMAGE' ? 'Image' : 'Video'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Album Dialog */}
      <CreateAlbumDialog
        open={createAlbumDialogOpen}
        onOpenChange={setCreateAlbumDialogOpen}
        onCreateAlbum={handleCreateAlbum}
      />

      {/* Media Viewer Dialog */}
      <MediaViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
        canDelete={selectedMedia ? canDeleteMedia(selectedMedia) : false}
        onDelete={() => selectedMedia && handleDeleteMediaClick(selectedMedia.id)}
      />

      {/* Delete Media Confirmation Dialog */}
      <ConfirmDialog
        open={deleteMediaDialogOpen}
        onOpenChange={setDeleteMediaDialogOpen}
        title="Delete Media"
        description="Are you sure you want to delete this media? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteMedia}
      />

      {/* Delete Album Confirmation Dialog */}
      <ConfirmDialog
        open={deleteAlbumDialogOpen}
        onOpenChange={setDeleteAlbumDialogOpen}
        title="Delete Album"
        description="Are you sure you want to delete this album? Media will not be deleted."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteAlbum}
      />
    </div>
  )
}

// Create Album Dialog Component
function CreateAlbumDialog({ open, onOpenChange, onCreateAlbum }: any) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    onCreateAlbum(name, description)
    setName('')
    setDescription('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Album</DialogTitle>
            <DialogDescription>
              Create a new album to organize your photos and videos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="album-name">Album Name</Label>
              <Input
                id="album-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter album name"
                required
              />
            </div>
            <div>
              <Label htmlFor="album-description">Description (Optional)</Label>
              <Textarea
                id="album-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter album description"
                rows={3}
              />
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
            <Button type="submit" disabled={!name.trim()}>
              Create Album
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Media Viewer Dialog Component
function MediaViewerDialog({ open, onOpenChange, media, canDelete, onDelete }: any) {
  if (!media) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{media.originalFilename}</span>
            <div className="flex gap-2">
              <a
                href={media.filePath}
                download={media.originalFilename}
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
              {canDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-h-[60vh] flex items-center justify-center bg-muted rounded-lg overflow-hidden">
            {media.mediaType === 'IMAGE' ? (
              <img
                src={media.filePath}
                alt={media.originalFilename}
                className="max-w-full max-h-[60vh] object-contain"
              />
            ) : (
              <video
                src={media.filePath}
                controls
                className="max-w-full max-h-[60vh]"
              />
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>
                Uploaded by {media.uploadedBy.name || media.uploadedBy.email}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDateTime(media.createdAt)}</span>
            </div>
            {media.album && (
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <span>Album: {media.album.name}</span>
              </div>
            )}
            <div className="text-muted-foreground">
              Size: {(media.fileSize / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


