import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { NewTestBuilder } from '@/components/tests/new-test-builder'

interface Props {
  searchParams: Promise<{ staffId?: string; eventId?: string }>
}

export default async function ESNewTestPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/es')
  }

  const params = await searchParams
  const { staffId, eventId } = params

  if (!staffId) {
    redirect('/es')
  }

  // Verify this staff membership belongs to the user
  const staffMembership = await prisma.tournamentStaff.findFirst({
    where: {
      id: staffId,
      OR: [
        { userId: session.user.id },
        { email: { equals: session.user.email, mode: 'insensitive' } },
      ],
      status: 'ACCEPTED',
    },
    include: {
      tournament: {
        select: {
          id: true,
          name: true,
          division: true,
        },
      },
      events: {
        include: {
          event: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!staffMembership) {
    redirect('/es')
  }

  // Find the event name if eventId is provided
  const selectedEvent = eventId 
    ? staffMembership.events.find(e => e.event.id === eventId)?.event
    : null

  return (
    <NewTestBuilder
      esMode={true}
      staffMembershipId={staffMembership.id}
      tournamentId={staffMembership.tournament.id}
      tournamentName={staffMembership.tournament.name}
      tournamentDivision={staffMembership.tournament.division}
      eventId={eventId}
      eventName={selectedEvent?.name}
    />
  )
}

