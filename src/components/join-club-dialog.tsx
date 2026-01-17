'use client'

import { useState, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { ButtonLoading } from '@/components/ui/loading-spinner'

interface JoinClubDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCode?: string
}

export function JoinClubDialog({ open, onOpenChange, initialCode = '' }: JoinClubDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState(initialCode)

  // Update code when initialCode changes
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode)
    }
  }, [initialCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/clubs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join club')
      }

      toast({
        title: 'Success!',
        description: data.message,
      })
      onOpenChange(false)
      // Refresh the router to update server-side data
      router.refresh()
      // Navigate to the club
      router.push(`/club/${data.membership.club.id}`)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join club. Please check the invite code.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Join Club</DialogTitle>
            <DialogDescription>
              Enter an invite code from your club admin to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {initialCode && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
                Invite link detected. We&apos;ve pre-filled the code below for you.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Invite Code</Label>
              <Input
                id="code"
                placeholder="Enter 12-character code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !code.trim()}>
              {loading && <ButtonLoading />}
              {loading ? 'Joining...' : 'Join Club'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Keep backward compatibility export
export { JoinClubDialog as JoinTeamDialog }

