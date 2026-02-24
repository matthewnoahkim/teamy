'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { FileText } from 'lucide-react'

function NoteSheetContent({ content }: { content: string }) {
  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-900">
        {content}
      </div>
    </div>
  )
}

interface NoteSheetViewerProps {
  testId: string
}

export function NoteSheetViewer({ testId }: NoteSheetViewerProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [noteSheet, setNoteSheet] = useState<{
    type: string
    content?: string
    filePath?: string
    filename?: string
    status: string
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchNoteSheet = async () => {
    setLoading(true)
    try {
      // First check if note sheets are enabled
      const testResponse = await fetch(`/api/tests/${testId}`)
      if (!testResponse.ok) {
        throw new Error('Failed to fetch test')
      }
      const testData = await testResponse.json()
      
      if (!testData.test?.allowNoteSheet) {
        toast({
          title: 'Note Sheets Not Enabled',
          description: 'Note sheets are not enabled for this test',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const response = await fetch(`/api/tests/${testId}/note-sheets`)
      if (!response.ok) {
        throw new Error('Failed to fetch note sheet')
      }
      const data = await response.json()
      if (data.noteSheet && data.noteSheet.status === 'ACCEPTED') {
        setNoteSheet(data.noteSheet)
        setOpen(true)
      } else {
        toast({
          title: 'No Note Sheet',
          description: 'You do not have an accepted note sheet for this test',
          variant: 'destructive',
        })
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load note sheet',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={fetchNoteSheet}
        disabled={loading}
      >
        <FileText className="h-4 w-4 mr-2" />
        Note Sheet
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Note Sheet</DialogTitle>
            <DialogDescription>Your accepted note sheet for this test</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {noteSheet?.type === 'CREATED' ? (
              <NoteSheetContent content={noteSheet.content || ''} />
            
            ) : noteSheet?.type === 'UPLOADED' ? (
              <div className="w-full h-full">
                {noteSheet.filePath ? (
                  <iframe
                    src={noteSheet.filePath}
                    className="w-full h-[calc(90vh-8rem)] border rounded-lg"
                    title={noteSheet.filename || 'Note Sheet PDF'}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/50">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">{noteSheet.filename}</p>
                    <p className="text-sm text-muted-foreground">File not available</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No note sheet available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

