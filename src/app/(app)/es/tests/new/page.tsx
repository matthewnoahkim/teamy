import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { NewTestBuilder } from '@/components/tests/new-test-builder'
import { ensureTournamentDirectorStaff } from '@/lib/tournament-director-staff'

interface Props {
  searchParams: Promise<{
    staffId?: string
    tournamentId?: string
    eventId?: string
    eventName?: string
    trialEventDivision?: string
  }>
}

export default async function ESNewTestPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/es')
  }

  const params = await searchParams
  const { staffId, tournamentId, eventId, eventName } = params

  if (!staffId && !tournamentId) {
    redirect('/es')
  }

  // Verify this staff membership belongs to the user
  let resolvedStaffId = staffId
  let staffMembership = resolvedStaffId
    ? await prisma.tournamentStaff.findFirst({
        where: {
          id: resolvedStaffId,
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
    : null

  if (!staffMembership && tournamentId) {
    const ensuredStaff = await ensureTournamentDirectorStaff({
      tournamentId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
    })

    resolvedStaffId = ensuredStaff?.id
    if (resolvedStaffId) {
      staffMembership = await prisma.tournamentStaff.findUnique({
        where: { id: resolvedStaffId },
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
    }
  }

  if (!staffMembership) {
    redirect('/es')
  }

  // Find the event name if eventId is provided
  let selectedEvent = eventId
    ? staffMembership.events.find(e => e.event.id === eventId)?.event
    : null

  if (!selectedEvent && eventId) {
    const fallbackEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
      },
    })
    if (fallbackEvent) {
      selectedEvent = fallbackEvent
    }
  }

  const trialEventDivision =
    params.trialEventDivision === 'B' || params.trialEventDivision === 'C'
      ? params.trialEventDivision
      : undefined

  return (
    <NewTestBuilder
      esMode={true}
      staffMembershipId={staffMembership.id}
      tournamentId={staffMembership.tournament.id}
      tournamentName={staffMembership.tournament.name}
      tournamentDivision={staffMembership.tournament.division}
      eventId={eventId}
      eventName={selectedEvent?.name || eventName?.trim()}
      trialEventDivision={trialEventDivision}
    />
  )
}
