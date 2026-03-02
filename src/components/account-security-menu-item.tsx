'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Shield, Trash2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'

interface AccountSecurityMenuItemProps {
  email: string
  deleteRedirectUrl?: string
}

export function AccountSecurityMenuItem({
  email,
  deleteRedirectUrl = '/login?accountDeleted=1',
}: AccountSecurityMenuItemProps) {
  const { toast } = useToast()
  const [accountSecurityDialogOpen, setAccountSecurityDialogOpen] = useState(false)
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false)
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  const handleDeleteAccount = async () => {
    if (deleteAccountConfirmation !== 'DELETE' || deletingAccount) return

    setDeletingAccount(true)
    try {
      const response = await fetch('/api/user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteAccountConfirmation }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete account')
      }

      await signOut({ callbackUrl: deleteRedirectUrl })
    } catch (error) {
      toast({
        title: 'Unable to delete account',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
      setDeletingAccount(false)
    }
  }

  return (
    <>
      <DropdownMenuItem onClick={() => setAccountSecurityDialogOpen(true)}>
        <Shield className="mr-2 h-4 w-4" />
        Account & Security
      </DropdownMenuItem>

      <Dialog open={accountSecurityDialogOpen} onOpenChange={setAccountSecurityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account & Security</DialogTitle>
            <DialogDescription>
              Manage account-level settings and security actions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Signed in as</p>
              <p className="text-sm text-muted-foreground break-all">{email}</p>
            </div>

            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">Danger Zone</p>
              <p className="text-xs text-muted-foreground">
                Deleting your account permanently removes your account and all associated data.
              </p>
              <Button
                type="button"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => {
                  setAccountSecurityDialogOpen(false)
                  setDeleteAccountDialogOpen(true)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteAccountDialogOpen}
        onOpenChange={(open) => {
          if (deletingAccount) return
          setDeleteAccountDialogOpen(open)
          if (!open) {
            setDeleteAccountConfirmation('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all associated data. Type DELETE to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-account-confirmation">Confirmation</Label>
            <Input
              id="delete-account-confirmation"
              value={deleteAccountConfirmation}
              onChange={(event) => setDeleteAccountConfirmation(event.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (deletingAccount) return
                setDeleteAccountDialogOpen(false)
                setDeleteAccountConfirmation('')
              }}
              disabled={deletingAccount}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={deleteAccountConfirmation !== 'DELETE' || deletingAccount}
            >
              {deletingAccount ? 'Deleting account...' : 'Delete my account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
