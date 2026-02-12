'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Upload, FileText, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function formatFileSize(bytes: number): string {
  // Always show in MB for consistency
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

interface NoteSheetUploadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  testId: string
  onSuccess: () => void
  instructions?: string | null
}

export function NoteSheetUpload({
  open,
  onOpenChange,
  testId,
  onSuccess,
  instructions: initialInstructions,
}: NoteSheetUploadProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [instructions, setInstructions] = useState<string | null>(initialInstructions || null)
  const [isDragging, setIsDragging] = useState(false)
  const [autoApproveNoteSheet, setAutoApproveNoteSheet] = useState<boolean | null>(null)

  useEffect(() => {
    if (open) {
      // Fetch test to get instructions and autoApproveNoteSheet setting
      fetch(`/api/tests/${testId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.test) {
            setInstructions(data.test.noteSheetInstructions || initialInstructions || null)
            setAutoApproveNoteSheet(data.test.autoApproveNoteSheet ?? true)
          } else {
            // Fallback to initial instructions if provided
            if (initialInstructions !== undefined) {
              setInstructions(initialInstructions)
            }
            // Default to true if we can't determine
            setAutoApproveNoteSheet(true)
          }
        })
        .catch(() => {
          // Fallback to initial instructions if fetch fails
          if (initialInstructions !== undefined) {
            setInstructions(initialInstructions)
          }
        })
    } else {
      // Reset when dialog closes
      setFile(null)
      setIsDragging(false)
      setAutoApproveNoteSheet(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open, testId, initialInstructions])

  const validateAndSetFile = (selectedFile: File) => {
    // Validate PDF
    if (selectedFile.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Only PDF files are allowed',
        variant: 'destructive',
      })
      return false
    }

    // Validate file size (50MB)
    const maxSize = 50 * 1024 * 1024
    if (selectedFile.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'File size must be less than 50MB',
        variant: 'destructive',
      })
      return false
    }

    setFile(selectedFile)
    return true
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    validateAndSetFile(selectedFile)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files?.[0]
    if (!droppedFile) return

    validateAndSetFile(droppedFile)
  }

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'Error',
        description: 'Please select a PDF file',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('type', 'UPLOADED')
      formData.append('file', file)

      const response = await fetch(`/api/tests/${testId}/note-sheets`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload note sheet')
      }

      toast({
        title: 'Success',
        description: 'Note sheet submitted for review',
      })

      onSuccess()
      onOpenChange(false)
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload note sheet',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Upload Note Sheet</DialogTitle>
          <DialogDescription>
            Upload a PDF file as your note sheet. Maximum file size: 50MB
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
          {instructions && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1.5">Instructions:</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{instructions}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="file-upload">PDF File</Label>
            {!file ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium mb-1">
                  {isDragging ? 'Drop your PDF file here' : 'Click to select a PDF file'}
                </p>
                <p className="text-xs text-muted-foreground">or drag and drop</p>
                <Input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 p-0 flex-shrink-0"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  Choose Different File
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading 
              ? 'Uploading...' 
              : autoApproveNoteSheet === false 
                ? 'Submit for Review' 
                : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

