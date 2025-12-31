'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2, Calendar, Users, Tag, Gift } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface PromoCode {
  id: string
  code: string
  effectType: 'PRO_SUBSCRIPTION' | 'CLUB_BOOST'
  effectDuration: number
  activatesAt: string | null
  expiresAt: string | null
  maxRedemptions: number | null
  currentRedemptions: number
  createdAt: string
  redemptions: Array<{
    id: string
    userId: string
    redeemedAt: string
    expiresAt: string
    user: {
      name: string | null
      email: string
    }
  }>
}

export function PromoCodeManager() {
  const { toast } = useToast()
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedPromoCode, setSelectedPromoCode] = useState<PromoCode | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  // Form state
  const [newCode, setNewCode] = useState({
    code: '',
    effectType: 'PRO_SUBSCRIPTION' as 'PRO_SUBSCRIPTION' | 'CLUB_BOOST',
    effectDuration: 1,
    activatesAt: '',
    expiresAt: '',
    maxRedemptions: '',
  })

  const [editForm, setEditForm] = useState({
    activatesAt: '',
    expiresAt: '',
    maxRedemptions: '',
  })

  const fetchPromoCodes = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dev/promo-codes')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch promo codes')
      }

      setPromoCodes(data.promoCodes)
    } catch (error) {
      console.error('Failed to fetch promo codes:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch promo codes',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPromoCodes()
  }, [])

  const handleCreatePromoCode = async () => {
    if (!newCode.code.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a promo code',
        variant: 'destructive',
      })
      return
    }

    if (newCode.effectDuration <= 0) {
      toast({
        title: 'Error',
        description: 'Duration must be greater than 0',
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch('/api/dev/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.code.trim(),
          effectType: newCode.effectType,
          effectDuration: newCode.effectDuration,
          activatesAt: newCode.activatesAt || null,
          expiresAt: newCode.expiresAt || null,
          maxRedemptions: newCode.maxRedemptions ? parseInt(newCode.maxRedemptions) : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create promo code')
      }

      toast({
        title: 'Success',
        description: 'Promo code created successfully!',
      })

      setIsCreateDialogOpen(false)
      setNewCode({
        code: '',
        effectType: 'PRO_SUBSCRIPTION',
        effectDuration: 1,
        activatesAt: '',
        expiresAt: '',
        maxRedemptions: '',
      })
      fetchPromoCodes()
    } catch (error) {
      console.error('Failed to create promo code:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create promo code',
        variant: 'destructive',
      })
    }
  }

  const handleUpdatePromoCode = async () => {
    if (!selectedPromoCode) return

    try {
      const response = await fetch('/api/dev/promo-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPromoCode.id,
          activatesAt: editForm.activatesAt || null,
          expiresAt: editForm.expiresAt || null,
          maxRedemptions: editForm.maxRedemptions ? parseInt(editForm.maxRedemptions) : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update promo code')
      }

      toast({
        title: 'Success',
        description: 'Promo code updated successfully!',
      })

      setIsEditDialogOpen(false)
      setSelectedPromoCode(null)
      fetchPromoCodes()
    } catch (error) {
      console.error('Failed to update promo code:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update promo code',
        variant: 'destructive',
      })
    }
  }

  const handleDeletePromoCode = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promo code? This action cannot be undone.')) {
      return
    }

    setIsDeleting(id)
    try {
      const response = await fetch(`/api/dev/promo-codes?id=${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete promo code')
      }

      toast({
        title: 'Success',
        description: 'Promo code deleted successfully!',
      })

      fetchPromoCodes()
    } catch (error) {
      console.error('Failed to delete promo code:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete promo code',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const openEditDialog = (promoCode: PromoCode) => {
    setSelectedPromoCode(promoCode)
    setEditForm({
      activatesAt: promoCode.activatesAt ? new Date(promoCode.activatesAt).toISOString().slice(0, 16) : '',
      expiresAt: promoCode.expiresAt ? new Date(promoCode.expiresAt).toISOString().slice(0, 16) : '',
      maxRedemptions: promoCode.maxRedemptions?.toString() || '',
    })
    setIsEditDialogOpen(true)
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  const getPromoStatus = (promoCode: PromoCode) => {
    const now = new Date()
    if (promoCode.activatesAt && new Date(promoCode.activatesAt) > now) {
      return <Badge variant="secondary">Scheduled</Badge>
    }
    if (promoCode.expiresAt && new Date(promoCode.expiresAt) < now) {
      return <Badge variant="destructive">Expired</Badge>
    }
    if (promoCode.maxRedemptions && promoCode.currentRedemptions >= promoCode.maxRedemptions) {
      return <Badge variant="destructive">Maxed Out</Badge>
    }
    return <Badge className="bg-green-500">Active</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Promo Codes
              </CardTitle>
              <CardDescription>
                Create and manage promo codes for Pro subscriptions and club boosts
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Promo Code
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {promoCodes.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No promo codes yet</p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create First Promo Code
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Activates</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((promoCode) => (
                  <TableRow key={promoCode.id}>
                    <TableCell className="font-mono font-semibold">{promoCode.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {promoCode.effectType === 'PRO_SUBSCRIPTION' ? (
                          <>
                            <Gift className="h-3 w-3 mr-1" />
                            Pro
                          </>
                        ) : (
                          <>
                            <Users className="h-3 w-3 mr-1" />
                            Boost
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {promoCode.effectDuration} {promoCode.effectType === 'PRO_SUBSCRIPTION' ? 'week' : 'month'}
                      {promoCode.effectDuration > 1 ? 's' : ''}
                    </TableCell>
                    <TableCell>{getPromoStatus(promoCode)}</TableCell>
                    <TableCell>
                      {promoCode.currentRedemptions}
                      {promoCode.maxRedemptions ? ` / ${promoCode.maxRedemptions}` : ' / ∞'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(promoCode.activatesAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(promoCode.expiresAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(promoCode)}
                        >
                          <Calendar className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeletePromoCode(promoCode.id)}
                          disabled={isDeleting === promoCode.id}
                        >
                          {isDeleting === promoCode.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Promo Code</DialogTitle>
            <DialogDescription>
              Create a new promo code for users to redeem Pro subscriptions or club boosts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Promo Code *</Label>
              <Input
                id="code"
                placeholder="PROMO2024"
                value={newCode.code}
                onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectType">Effect Type *</Label>
              <Select
                value={newCode.effectType}
                onValueChange={(value: 'PRO_SUBSCRIPTION' | 'CLUB_BOOST') =>
                  setNewCode({ ...newCode, effectType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRO_SUBSCRIPTION">Pro Subscription</SelectItem>
                  <SelectItem value="CLUB_BOOST">Club Boost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">
                Duration * ({newCode.effectType === 'PRO_SUBSCRIPTION' ? 'weeks' : 'months'})
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={newCode.effectDuration}
                onChange={(e) => setNewCode({ ...newCode, effectDuration: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activatesAt">Activation Date (optional)</Label>
              <Input
                id="activatesAt"
                type="datetime-local"
                value={newCode.activatesAt}
                onChange={(e) => setNewCode({ ...newCode, activatesAt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expiration Date (optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={newCode.expiresAt}
                onChange={(e) => setNewCode({ ...newCode, expiresAt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRedemptions">Max Redemptions (optional)</Label>
              <Input
                id="maxRedemptions"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={newCode.maxRedemptions}
                onChange={(e) => setNewCode({ ...newCode, maxRedemptions: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePromoCode}>Create Promo Code</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Promo Code</DialogTitle>
            <DialogDescription>
              Update activation date, expiration date, and max redemptions for {selectedPromoCode?.code}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-activatesAt">Activation Date (optional)</Label>
              <Input
                id="edit-activatesAt"
                type="datetime-local"
                value={editForm.activatesAt}
                onChange={(e) => setEditForm({ ...editForm, activatesAt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-expiresAt">Expiration Date (optional)</Label>
              <Input
                id="edit-expiresAt"
                type="datetime-local"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-maxRedemptions">Max Redemptions (optional)</Label>
              <Input
                id="edit-maxRedemptions"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={editForm.maxRedemptions}
                onChange={(e) => setEditForm({ ...editForm, maxRedemptions: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePromoCode}>Update Promo Code</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

