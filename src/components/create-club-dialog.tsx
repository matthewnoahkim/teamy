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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/components/ui/use-toast'
import { ButtonLoading } from '@/components/ui/loading-spinner'

interface CreateClubDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateClubDialog({ open, onOpenChange }: CreateClubDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [division, setDivision] = useState<'B' | 'C'>('C')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, division }),
      })

      if (!response.ok) {
        throw new Error('Failed to create club')
      }

      const data = await response.json()
      toast({
        title: 'Club created!',
        description: `${name} (Division ${division})`,
      })
      // Refresh the router to update server-side data
      router.refresh()
      // Navigate to the new club
      router.push(`/club/${data.club.id}`)
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to create club. Please try again.',
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
            <DialogTitle>Create New Club</DialogTitle>
            <DialogDescription>
              Set up a new club. You&apos;ll be the club admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Club Name</Label>
              <Input
                id="name"
                placeholder="e.g., Los Altos High School"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="division">Division</Label>
              <RadioGroup value={division} onValueChange={(value) => setDivision(value as 'B' | 'C')} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="B" id="division-b" />
                  <Label htmlFor="division-b" className="cursor-pointer font-normal">
                    Division B (Grades 6-9)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="C" id="division-c" />
                  <Label htmlFor="division-c" className="cursor-pointer font-normal">
                    Division C (Grades 9-12)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name}>
              {loading && <ButtonLoading />}
              {loading ? 'Creating...' : 'Create Club'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Keep backward compatibility export
export { CreateClubDialog as CreateTeamDialog }

