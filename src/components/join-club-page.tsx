'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'
import { Loader2, ShieldCheck } from 'lucide-react'

interface JoinClubPageProps {
  initialCode?: string
  autoJoin?: boolean
}

export function JoinClubPage({ initialCode = '', autoJoin = false }: JoinClubPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [code, setCode] = useState(initialCode)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoJoinTriggered = useRef(false)

  useEffect(() => {
    setCode(initialCode)
  }, [initialCode])

  const handleJoin = useCallback(
    async (overrideCode?: string) => {
      const codeToUse = (overrideCode ?? code).trim()
      if (!codeToUse) {
        setError('Invite code is required')
        return
      }

      setJoining(true)
      setError(null)

      try {
        const response = await fetch('/api/clubs/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeToUse }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to join club')
        }

        toast({
          title: 'Success!',
          description: data.message,
        })

        router.refresh()
        router.push(`/club/${data.membership.club.id}`)
      } catch (err: any) {
        const message = err?.message || 'Failed to join club'
        setError(message)
        toast({
          title: 'Unable to join',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setJoining(false)
      }
    },
    [code, router, toast]
  )

  useEffect(() => {
    if (autoJoin && initialCode && !autoJoinTriggered.current) {
      autoJoinTriggered.current = true
      handleJoin(initialCode)
    }
  }, [autoJoin, handleJoin, initialCode])

  return (
    <div className="min-h-screen bg-background grid-pattern py-8 sm:py-10 md:py-12 px-3 sm:px-4">
      <div className="mx-auto max-w-xl space-y-6 sm:space-y-8">
        <div className="text-center space-y-2.5 sm:space-y-3">
          <div className="mx-auto flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300">
            <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight px-2">Join your club</h1>
          <p className="text-muted-foreground text-sm sm:text-base px-2">
            Enter the invite code that was shared with you or use the invite link you received.
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="px-4 sm:px-6 pt-5 sm:pt-6">
            <CardTitle className="text-lg sm:text-xl">Enter invite code</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Codes can also be shared as invite links and your club admins can regenerate them at any time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6">
            {initialCode && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
                Invite link detected. We&apos;ve pre-filled the code below and will automatically join once you&apos;re signed in.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="inviteCode" className="text-sm">Invite Code</Label>
              <Input
                id="inviteCode"
                placeholder="Enter 12-character code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={24}
                required
                className="text-sm sm:text-base"
              />
            </div>

            {error && (
              <p className="text-xs sm:text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              className="w-full text-sm sm:text-base"
              onClick={() => handleJoin()}
              disabled={joining || !code.trim()}
            >
              {joining ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Club'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm sm:text-base"
              onClick={() => router.push('/dashboard')}
              disabled={joining}
            >
              Go back to dashboard
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs sm:text-sm text-muted-foreground px-2">
          Need a code? Ask your coach or an admin for the latest invite link from the club settings page.
          {' '}
          <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-300">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}

// Keep backward compatibility export
export { JoinClubPage as JoinTeamPage }

