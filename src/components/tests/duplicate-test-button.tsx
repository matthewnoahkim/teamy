'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Copy } from 'lucide-react'

interface DuplicateTestButtonProps {
  testId: string
  testName: string
  clubId: string
}

export function DuplicateTestButton({
  testId,
  testName,
  clubId,
}: DuplicateTestButtonProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const response = await fetch(`/api/tests/${testId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate test')
      }

      toast({
        title: 'Test Duplicated',
        description: 'The test has been duplicated as a draft',
      })

      setOpen(false)
      // Navigate to the new test's page (will show builder for draft)
      router.push(`/club/${clubId}/tests/${data.test.id}`)
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to duplicate test',
        variant: 'destructive',
      })
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Copy className="h-4 w-4" />
        Duplicate Test
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Test</DialogTitle>
            <DialogDescription>
              Create a copy of &quot;{testName}&quot;? The duplicate will be created as a draft
              with all questions, assignments, and settings copied. Scheduling and passwords will be reset.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={duplicating}
            >
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={duplicating}>
              {duplicating ? 'Duplicating...' : 'Duplicate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

