'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { NewTestBuilder } from '@/components/tests/new-test-builder'

interface TournamentTestCreatorProps {
  tournamentId: string
  tournamentName: string
  tournamentDivision: 'B' | 'C'
  user: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
}

export function TournamentTestCreator({
  tournamentId,
  tournamentName,
  tournamentDivision,
  user,
}: TournamentTestCreatorProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-400/20 to-blue-400/20 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]"></div>
      </div>

      <div className="relative z-10 px-4 py-8 lg:px-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/tournaments/${tournamentId}/tests`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tournament Tests
          </Button>
          <p className="text-sm text-muted-foreground">
            Creating test for <span className="font-semibold">{tournamentName}</span>
          </p>
        </div>
        <NewTestBuilder
          tournamentId={tournamentId}
          tournamentName={tournamentName}
          tournamentDivision={tournamentDivision}
        />
      </div>
    </div>
  )
}

