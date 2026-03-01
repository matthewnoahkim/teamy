'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateClubDialog } from '@/components/create-club-dialog'
import { JoinClubDialog } from '@/components/join-club-dialog'
import { AppHeader } from '@/components/app-header'
import { Logo } from '@/components/logo'
import { Plus } from 'lucide-react'

interface NoClubsClientProps {
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
  initialCode?: string
  initialInviteClubId?: string
}

export function NoClubsClient({ user, initialCode = '', initialInviteClubId = '' }: NoClubsClientProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  // Auto-open join dialog if there's an initial code
  useEffect(() => {
    if (initialCode) {
      setJoinOpen(true)
    }
  }, [initialCode])

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <AppHeader user={user} showBackButton={false} />

      <main className="container mx-auto px-4 py-8 md:py-12 flex items-center justify-center min-h-[calc(100vh-80px)]">
        <Card className="border-dashed border-2 max-w-2xl w-full">
          <CardHeader className="text-center py-10 md:py-12 px-4">
            <div className="flex justify-center mb-6">
              <Logo size="lg" showText={false} />
            </div>
            <CardTitle className="text-2xl sm:text-3xl mb-3">Welcome to Teamy!</CardTitle>
            <CardDescription className="text-base md:text-lg">
              Get started by joining an existing club or creating your own
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row justify-center gap-4 pb-10 md:pb-12 px-4">
            <Button 
              onClick={() => setJoinOpen(true)} 
              size="lg" 
              className="w-full sm:w-auto"
            >
              Join Club
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setCreateOpen(true)} 
              size="lg" 
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Club
            </Button>
          </CardContent>
        </Card>

        <CreateClubDialog open={createOpen} onOpenChange={setCreateOpen} />
        <JoinClubDialog 
          open={joinOpen} 
          onOpenChange={setJoinOpen} 
          initialCode={initialCode}
          initialInviteClubId={initialInviteClubId}
        />
      </main>
    </div>
  )
}
