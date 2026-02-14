'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Download, X, File } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface Attachment {
  id: string
  filename: string
  originalFilename: string
  fileSize: number
  mimeType: string
  filePath: string
  uploadedBy: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface AttachmentDisplayProps {
  attachments: Attachment[]
  canDelete?: boolean
  onDelete?: (attachmentId: string) => void
}

export function AttachmentDisplay({ attachments, canDelete = false, onDelete }: AttachmentDisplayProps) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  if (!attachments || attachments.length === 0) return null

  const isImage = (mimeType: string) => mimeType.startsWith('image/')

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleDelete = async (attachmentId: string) => {
    if (!onDelete) return
    
    setDeleting(attachmentId)
    try {
      await onDelete(attachmentId)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const isImageFile = isImage(attachment.mimeType)
        const showAsImage = isImageFile && !failedImages[attachment.id]
        
        return (
          <div key={attachment.id}>
            {showAsImage ? (
              // Image display with preview
              <div className="border rounded-md overflow-hidden hover:bg-muted/50 transition-colors">
                <div className="relative group">
                  <Image
                    src={attachment.filePath}
                    alt={attachment.originalFilename}
                    width={1200}
                    height={900}
                    className="h-auto max-h-96 w-full object-contain"
                    sizes="(max-width: 768px) 100vw, 700px"
                    onError={() =>
                      setFailedImages((prev) => ({
                        ...prev,
                        [attachment.id]: true,
                      }))
                    }
                    unoptimized
                  />
                  {/* Overlay with actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 w-8 p-0 bg-background/90"
                      onClick={() => window.open(attachment.filePath, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canDelete && onDelete && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 w-8 p-0 bg-background/90"
                        onClick={() => handleDelete(attachment.id)}
                        disabled={deleting === attachment.id}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {/* Image filename and size */}
                <div className="px-3 py-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.originalFilename}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Non-image file display
              <div className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.originalFilename}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => window.open(attachment.filePath, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(attachment.id)}
                      disabled={deleting === attachment.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

