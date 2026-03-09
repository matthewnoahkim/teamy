'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { NewTestBuilder } from '@/components/tests/new-test-builder'

interface TournamentTestCreatorProps {
  tournamentId: string
  tournamentName: string
  tournamentDivision: 'B' | 'C'
  eventId?: string
  eventName?: string
  trialEventDivision?: 'B' | 'C'
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
  eventId,
  eventName,
  trialEventDivision,
  user: _user,
}: TournamentTestCreatorProps) {
  const router = useRouter()
  const targetLabel = eventName
    ? eventId
      ? `${tournamentName} - ${eventName}`
      : `${tournamentName} - ${eventName} (Trial${trialEventDivision ? `, Div ${trialEventDivision}` : ''})`
    : tournamentName

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <div className="px-4 py-8 lg:px-8">
        <div className="mb-6 rounded-xl border bg-card/60 backdrop-blur-sm p-4 sm:p-5">
          <Button
            variant="ghost"
            onClick={() => router.push(`/tournaments/${tournamentId}/tests`)}
            className="mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tournament Tests
          </Button>
          <h1 className="text-xl sm:text-2xl font-semibold">Create Tournament Test</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Building for <span className="font-semibold">{targetLabel}</span>. Use the builder below to draft, review, and publish.
          </p>
        </div>
        <NewTestBuilder
          tournamentId={tournamentId}
          tournamentName={tournamentName}
          tournamentDivision={tournamentDivision}
          eventId={eventId}
          eventName={eventName}
          trialEventDivision={trialEventDivision}
        />
      </div>
    </div>
  )
}
