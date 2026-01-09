import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isTournamentAdmin, hasESTestAccess } from '@/lib/rbac'
import { ESTestAttemptsView } from '@/components/tests/es-test-attempts-view'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ testId: string }>
}

export default async function ESTestResponsesPage({ params }: Props) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/es')
  }

  const { testId } = await params

  // Find the ES test
  // Use select to avoid fields that might not exist yet (if migration hasn't run)
  const esTest = await prisma.eSTest.findUnique({
    where: { id: testId },
    select: {
      id: true,
      name: true,
      description: true,
      tournamentId: true,
      staff: {
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              division: true,
            },
          },
        },
      },
    },
  })

  if (!esTest) {
    notFound()
  }

  // Verify user has access to this specific test or is admin
  // TDs have full access, ES only for their assigned events
  const hasAccess = await hasESTestAccess(session.user.id, session.user.email, testId)
  const isAdmin = await isTournamentAdmin(session.user.id, esTest.tournamentId)
  
  if (!hasAccess && !isAdmin) {
    redirect('/es')
  }

  // Get tournament info
  let tournament = esTest.staff?.tournament
  
  if (!tournament) {
    const tournamentData = await prisma.tournament.findUnique({
      where: { id: esTest.tournamentId },
      select: {
        id: true,
        name: true,
        division: true,
      },
    })
    
    if (!tournamentData) {
      redirect('/es')
    }
    
    tournament = tournamentData
  }

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <div className="container mx-auto max-w-6xl space-y-8 py-8 px-4 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <Link 
              href={`/es?tournament=${tournament.id}`}
              className="w-fit"
            >
              <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Tournament
              </Button>
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">{esTest.name}</h1>
            {esTest.description && (
              <p className="text-muted-foreground">{esTest.description}</p>
            )}
          </div>
        </div>

        <ESTestAttemptsView
          testId={esTest.id}
          testName={esTest.name}
          scoresReleased={(esTest as any).scoresReleased || false}
        />
      </div>
    </div>
  )
}

