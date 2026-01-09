'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { 
  Upload, 
  FileText, 
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Users,
  Calendar as CalendarIcon,
  Edit
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
import { Checkbox } from '@/components/ui/checkbox'
import { formatDateTime } from '@/lib/utils'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { ButtonLoading, PageLoading } from '@/components/ui/loading-spinner'

interface PaperworkTabProps {
  clubId: string
  user: any
  isAdmin: boolean
  initialForms?: any[]
}

export function PaperworkTab({ clubId, user, isAdmin, initialForms }: PaperworkTabProps) {
  const { toast } = useToast()
  const [forms, setForms] = useState<any[]>(initialForms || [])
  const [loading, setLoading] = useState(!initialForms)
  const [uploading, setUploading] = useState(false)
  
  // Dialogs
  const [uploadFormDialogOpen, setUploadFormDialogOpen] = useState(false)
  const [submitFormDialogOpen, setSubmitFormDialogOpen] = useState(false)
  const [viewSubmissionsDialogOpen, setViewSubmissionsDialogOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState<any | null>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [notSubmitted, setNotSubmitted] = useState<any[]>([])
  const [deleteFormDialogOpen, setDeleteFormDialogOpen] = useState(false)
  const [formToDelete, setFormToDelete] = useState<string | null>(null)
  const [deletingForm, setDeletingForm] = useState(false)
  
  const formFileInputRef = useRef<HTMLInputElement>(null)
  const submissionFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!initialForms) {
      fetchForms()
    }
  }, [clubId, initialForms])

  const fetchForms = async () => {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const response = await fetch(`/api/forms?clubId=${clubId}`, {
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) throw new Error('Failed to fetch forms')
      const data = await response.json()
      setForms(data.forms || [])
    } catch (error: any) {
      // Don't show error on abort (user navigated away)
      if (error.name === 'AbortError') {
        return
      }
      
      console.error('Failed to fetch forms:', error)
      toast({
        title: 'Error',
        description: 'Failed to load forms. Please refresh the page.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUploadForm = async (formData: FormData) => {
    setUploading(true)
    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload form')
      }

      toast({
        title: 'Form uploaded',
        description: 'Form uploaded successfully',
      })

      fetchForms()
      setUploadFormDialogOpen(false)
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload form',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitForm = async (formData: FormData) => {
    if (!selectedForm) return

    setUploading(true)
    try {
      const response = await fetch(`/api/forms/${selectedForm.id}/submissions`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit form')
      }

      toast({
        title: 'Form submitted',
        description: 'Your signed form has been submitted successfully',
      })

      fetchForms()
      setSubmitFormDialogOpen(false)
      setSelectedForm(null)
    } catch (error: any) {
      toast({
        title: 'Submission failed',
        description: error.message || 'Failed to submit form',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFormClick = (formId: string) => {
    setFormToDelete(formId)
    setDeleteFormDialogOpen(true)
  }

  const handleDeleteForm = async () => {
    if (!formToDelete) return

    setDeletingForm(true)
    try {
      const response = await fetch(`/api/forms/${formToDelete}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete form')

      toast({
        title: 'Form deleted',
        description: 'Form deleted successfully',
      })

      fetchForms()
      setDeleteFormDialogOpen(false)
      setFormToDelete(null)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete form',
        variant: 'destructive',
      })
    } finally {
      setDeletingForm(false)
    }
  }

  const handleViewSubmissions = async (form: any) => {
    setSelectedForm(form)
    setViewSubmissionsDialogOpen(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const response = await fetch(`/api/forms/${form.id}/submissions`, {
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) throw new Error('Failed to fetch submissions')
      const data = await response.json()
      setSubmissions(data.submissions || [])
      setNotSubmitted(data.notSubmitted || [])
    } catch (error: any) {
      if (error.name === 'AbortError') return
      
      toast({
        title: 'Error',
        description: 'Failed to load submissions',
        variant: 'destructive',
      })
    }
  }

  const handleUpdateSubmissionStatus = async (submissionId: string, status: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) throw new Error('Failed to update submission status')

      toast({
        title: 'Status updated',
        description: `Submission ${status.toLowerCase()}`,
      })

      // Refresh submissions
      if (selectedForm) {
        handleViewSubmissions(selectedForm)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      })
    }
  }

  const getFormStatus = (form: any) => {
    if (form.submissions && form.submissions.length > 0) {
      const submission = form.submissions[0]
      return {
        submitted: true,
        status: submission.status,
        submittedAt: submission.submittedAt,
        filePath: submission.filePath,
        originalFilename: submission.originalFilename,
      }
    }
    return { submitted: false }
  }

  if (loading) {
    return (
      <PageLoading
        title="Loading paperwork"
        description="Fetching forms and submissions..."
        variant="orbit"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Paperwork</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Forms and documents for tournaments and events
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setUploadFormDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Form
          </Button>
        )}
      </div>

      {/* Forms List */}
      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No forms yet.
            </p>
            {isAdmin && (
              <Button onClick={() => setUploadFormDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Form
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {forms.map((form) => {
            const status = getFormStatus(form)
            const isOverdue = form.dueDate && new Date(form.dueDate) < new Date() && !status.submitted

            return (
              <Card key={form.id} className={isOverdue ? 'border-red-300 dark:border-red-800' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {form.title}
                        {form.isRequired && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Overdue
                          </Badge>
                        )}
                      </CardTitle>
                      {form.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {form.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {form.dueDate && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            Due: {format(new Date(form.dueDate), 'MMM d, yyyy')}
                          </span>
                        )}
                        {isAdmin && (
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {form._count.submissions} / {/* You'll need to calculate total team members */}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFormClick(form.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      {status.submitted ? (
                        <div className="flex items-center gap-2">
                          {status.status === 'APPROVED' && (
                            <Badge className="bg-green-500 text-white dark:bg-green-600 dark:text-white border-green-600 dark:border-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          )}
                          {status.status === 'REJECTED' && (
                            <Badge className="bg-red-500 text-white dark:bg-red-600 dark:text-white border-red-600 dark:border-red-500">
                              <XCircle className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                          {status.status === 'PENDING' && (
                            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending Review
                            </Badge>
                          )}
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Submitted {formatDateTime(status.submittedAt)}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-gray-600">
                          Not Submitted
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <a href={form.filePath} download={form.originalFilename}>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Form
                        </Button>
                      </a>
                      {status.submitted ? (
                        <a href={status.filePath} download={status.originalFilename}>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            View Submission
                          </Button>
                        </a>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedForm(form)
                            setSubmitFormDialogOpen(true)
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Submit Signed Form
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewSubmissions(form)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          View All ({form._count.submissions})
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Upload Form Dialog */}
      <UploadFormDialog
        open={uploadFormDialogOpen}
        onOpenChange={setUploadFormDialogOpen}
        onUpload={handleUploadForm}
        clubId={clubId}
        uploading={uploading}
      />

      {/* Submit Form Dialog */}
      <SubmitFormDialog
        open={submitFormDialogOpen}
        onOpenChange={setSubmitFormDialogOpen}
        onSubmit={handleSubmitForm}
        form={selectedForm}
        uploading={uploading}
      />

      {/* View Submissions Dialog */}
      <ViewSubmissionsDialog
        open={viewSubmissionsDialogOpen}
        onOpenChange={setViewSubmissionsDialogOpen}
        form={selectedForm}
        submissions={submissions}
        notSubmitted={notSubmitted}
        onUpdateStatus={handleUpdateSubmissionStatus}
      />

      {/* Delete Form Confirmation Dialog */}
      <ConfirmDialog
        open={deleteFormDialogOpen}
        onOpenChange={setDeleteFormDialogOpen}
        title="Delete Form"
        description="Are you sure you want to delete this form? All submissions will be deleted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteForm}
      />
    </div>
  )
}

// Upload Form Dialog Component
function UploadFormDialog({ open, onOpenChange, onUpload, clubId, uploading }: any) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !title.trim()) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('clubId', clubId)
    formData.append('title', title)
    if (description) formData.append('description', description)
    if (dueDate) formData.append('dueDate', dueDate)
    formData.append('isRequired', String(isRequired))

    onUpload(formData)

    // Reset form
    setTitle('')
    setDescription('')
    setDueDate('')
    setIsRequired(false)
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Upload Form</DialogTitle>
            <DialogDescription>
              Upload a form template for team members to complete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Form Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Tournament Release Form"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional instructions or information"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isRequired"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(checked as boolean)}
              />
              <Label htmlFor="isRequired" className="cursor-pointer">
                This form is required
              </Label>
            </div>
            <div>
              <Label htmlFor="form-file">Form File</Label>
              <Input
                ref={fileInputRef}
                id="form-file"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                PDF, Word, or image files (max 50MB)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!file || !title.trim() || uploading}>
              {uploading && <ButtonLoading />}
              {uploading ? 'Uploading...' : 'Upload Form'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Submit Form Dialog Component
function SubmitFormDialog({ open, onOpenChange, onSubmit, form, uploading }: any) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    if (notes) formData.append('notes', notes)

    onSubmit(formData)

    // Reset form
    setFile(null)
    setNotes('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!form) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Submit Signed Form</DialogTitle>
            <DialogDescription>
              Upload your completed and signed version of {form.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="submission-file">Signed Form File</Label>
              <Input
                ref={fileInputRef}
                id="submission-file"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                PDF, Word, or image files (max 50MB)
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!file || uploading}>
              {uploading && <ButtonLoading />}
              {uploading ? 'Submitting...' : 'Submit Form'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// View Submissions Dialog Component
function ViewSubmissionsDialog({ 
  open, 
  onOpenChange, 
  form, 
  submissions, 
  notSubmitted,
  onUpdateStatus
}: any) {
  if (!form) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.title} - Submissions</DialogTitle>
          <DialogDescription>
            {submissions.length} submitted / {submissions.length + notSubmitted.length} total
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Submitted */}
          {submissions.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Submitted ({submissions.length})</h3>
              <div className="space-y-2">
                {submissions.map((submission: any) => (
                  <Card key={submission.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={submission.user.image || ''} />
                          <AvatarFallback>
                            {submission.user.name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {submission.user.name || submission.user.email}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Submitted {formatDateTime(submission.submittedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {submission.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onUpdateStatus(submission.id, 'APPROVED')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onUpdateStatus(submission.id, 'REJECTED')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {submission.status === 'APPROVED' && (
                          <Badge className="bg-green-500 text-white dark:bg-green-600 dark:text-white border-green-600 dark:border-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {submission.status === 'REJECTED' && (
                          <Badge className="bg-red-500 text-white dark:bg-red-600 dark:text-white border-red-600 dark:border-red-500">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                        <a href={submission.filePath} download={submission.originalFilename}>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Not Submitted */}
          {notSubmitted.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-red-600 dark:text-red-400">
                Not Submitted ({notSubmitted.length})
              </h3>
              <div className="space-y-2">
                {notSubmitted.map((user: any) => (
                  <Card key={user.id}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Avatar>
                        <AvatarImage src={user.image || ''} />
                        <AvatarFallback>
                          {user.name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name || user.email}</p>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Not yet submitted
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

