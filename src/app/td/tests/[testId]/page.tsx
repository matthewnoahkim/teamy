import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { NewTestBuilder } from '@/components/tests/new-test-builder'
import { hasESTestAccess } from '@/lib/rbac'

interface Props {
  params: Promise<{ testId: string }>
}

// Helper to check if user is a tournament director for a tournament
async function isTournamentDirector(userId: string, userEmail: string, tournamentId: string): Promise<boolean> {
  // Check if user is tournament admin
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  
  if (admin) return true
  
  // Check if user created the tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  if (tournament?.createdById === userId) return true
  
  // Check if user is the director on the hosting request
  const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
    where: {
      tournament: {
        id: tournamentId,
      },
      directorEmail: {
        equals: userEmail,
        mode: 'insensitive',
      },
      status: 'APPROVED',
    },
  })
  
  if (hostingRequest) return true
  
  // Also check if user is a TD via TournamentStaff
  const staffRecord = await prisma.tournamentStaff.findFirst({
    where: {
      tournamentId,
      role: 'TOURNAMENT_DIRECTOR',
      status: 'ACCEPTED',
      OR: [
        { userId },
        {
          email: {
            equals: userEmail,
            mode: 'insensitive',
          },
        },
      ],
    },
  })
  
  return !!staffRecord
}

export default async function TDEditTestPage({ params }: Props) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/td')
  }

  const { testId } = await params

  // Find the ES test
  const esTest = await prisma.eSTest.findUnique({
    where: { id: testId },
    include: {
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
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
        },
      },
      questions: {
        include: {
          options: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!esTest || !esTest.event?.id) {
    notFound()
  }

  // Prevent editing published tests
  if (esTest.status === 'PUBLISHED') {
    redirect('/td')
  }

  // Verify user has access to this specific test
  // TDs have full access, ES only for their assigned events
  const hasAccess = await hasESTestAccess(session.user.id, session.user.email, testId)
  
  if (!hasAccess) {
    redirect('/td')
  }

  // Get tournament info - fetch directly if not available from staff relation
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
      redirect('/td')
    }
    
    tournament = tournamentData
  }

  // Format the test for the builder
  const formattedTest = {
    id: esTest.id,
    name: esTest.name,
    description: esTest.description,
    instructions: esTest.instructions,
    durationMinutes: esTest.durationMinutes,
    maxAttempts: null,
    scoreReleaseMode: 'NONE' as const,
    randomizeQuestionOrder: false,
    randomizeOptionOrder: false,
    requireFullscreen: esTest.requireFullscreen ?? true,
    allowCalculator: false,
    calculatorType: null,
    allowNoteSheet: false,
    noteSheetInstructions: null,
    status: esTest.status as 'DRAFT' | 'PUBLISHED' | 'CLOSED',
    assignments: [],
    questions: esTest.questions.map((q: any) => ({
      id: q.id,
      type: q.type,
      promptMd: q.promptMd,
      explanation: q.explanation,
      points: Number(q.points),
      shuffleOptions: q.shuffleOptions,
      options: q.options.map((o: any) => ({
        id: o.id,
        label: o.label,
        isCorrect: o.isCorrect,
        order: o.order,
      })),
    })),
  }

  // Use the test's current staffId for editing (TDs can edit any test)
  const staffMembershipIdToUse = esTest.staffId

  return (
    <NewTestBuilder
      esMode={true}
      staffMembershipId={staffMembershipIdToUse}
      tournamentId={esTest.tournamentId}
      tournamentName={tournament.name}
      tournamentDivision={tournament.division}
      eventId={esTest.event?.id}
      eventName={esTest.event?.name}
      test={formattedTest}
    />
  )
}

