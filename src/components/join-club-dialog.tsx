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
  initialInviteClubId?: string
}

interface InvitePreview {
  club: {
    id: string
    name: string
  }
  role: 'ADMIN' | 'MEMBER'
  alreadyMember: boolean
}

export function JoinClubDialog({
  open,
  onOpenChange,
  initialCode = '',
  initialInviteClubId = '',
}: JoinClubDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState(initialCode)
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
  const [resolvingInvite, setResolvingInvite] = useState(false)
  const isAlreadyMember = Boolean(invitePreview?.alreadyMember)

  // Update code when initialCode changes
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode)
    }
  }, [initialCode])

  useEffect(() => {
    if (!open || !initialCode) {
      if (!open) {
        setInvitePreview(null)
        setResolvingInvite(false)
      }
      return
    }

    const controller = new AbortController()
    const resolveInvitePreview = async () => {
      setResolvingInvite(true)
      try {
        const previewParams = new URLSearchParams({
          code: initialCode,
          ...(initialInviteClubId ? { clubId: initialInviteClubId } : {}),
        })
        const response = await fetch(`/api/clubs/join?${previewParams.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          setInvitePreview(null)
          return
        }
        const data: InvitePreview = await response.json()
        setInvitePreview(data)
      } catch {
        setInvitePreview(null)
      } finally {
        if (!controller.signal.aborted) {
          setResolvingInvite(false)
        }
      }
    }

    resolveInvitePreview()

    return () => {
      controller.abort()
    }
  }, [open, initialCode, initialInviteClubId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/clubs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          ...(initialInviteClubId ? { clubId: initialInviteClubId } : {}),
        }),
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
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to join club. Please check the invite code.',
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
                {resolvingInvite
                  ? 'Invite link detected. Verifying invite details...'
                  : invitePreview
                    ? isAlreadyMember
                      ? `You are already a member of ${invitePreview.club.name}.`
                      : `Invite link detected for ${invitePreview.club.name} (${invitePreview.role === 'ADMIN' ? 'admin' : 'member'} access). We've pre-filled the code below for you.`
                    : "Invite link detected. We've pre-filled the code below for you."}
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
            {isAlreadyMember && invitePreview ? (
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  router.push(`/club/${invitePreview.club.id}`)
                }}
              >
                Go to Club
              </Button>
            ) : (
              <Button type="submit" disabled={loading || !code.trim()}>
                {loading && <ButtonLoading />}
                {loading ? 'Joining...' : 'Join Club'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Keep backward compatibility export
export { JoinClubDialog as JoinTeamDialog }
