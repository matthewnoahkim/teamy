import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { NewTestBuilder } from '@/components/tests/new-test-builder'

interface Props {
  params: Promise<{ testId: string }>
}

export default async function ESEditTestPage({ params }: Props) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/es')
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
    redirect('/es')
  }

  // Verify user has access (assigned to the same event - collaborative access)
  // OR user is a tournament director for this tournament
  // Check ALL staff memberships to find one where user is assigned to the event
  // and the tournament matches the test's tournament
  const userStaffMemberships = await prisma.tournamentStaff.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { email: { equals: session.user.email, mode: 'insensitive' } },
      ],
      status: 'ACCEPTED',
    },
    include: {
      events: {
        select: {
          eventId: true,
        },
      },
      tournament: {
        select: {
          id: true,
          name: true,
          division: true,
        },
      },
    },
  })

  // Check if user has access to this specific test
  // TDs have full access, ES only for their assigned events
  const { hasESTestAccess } = await import('@/lib/rbac')
  const hasAccess = await hasESTestAccess(session.user.id, session.user.email, testId)

  if (!hasAccess) {
    redirect('/es')
  }

  // Find a staff membership for this tournament
  const userStaff = userStaffMemberships.find(staff => 
    staff.tournament.id === esTest.tournamentId
  )

  // If TD, allow access even without staff membership
  // Use the staff membership that matches the test's tournament, or fallback to any matching membership
  // If TD, prefer TD staff membership, otherwise use event-based one
  // For TDs without staff membership, use the test's current staffId
  const staffToUse = userStaff || userStaffMemberships.find(staff => 
    staff.tournament.id === esTest.tournamentId
  )

  // If TD but no staff membership found, we still allow access but need to handle staffMembershipId
  // In this case, we'll use the test's original staff membership (TDs can edit any test)
  const staffMembershipIdToUse = staffToUse?.id || esTest.staffId

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

  // Get tournament info for the builder
  const tournament = esTest.staff?.tournament || (staffToUse ? staffToUse.tournament : null)
  
  if (!tournament) {
    redirect('/es')
  }

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

