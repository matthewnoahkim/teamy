import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { TournamentTestsClient } from '@/components/tournament-tests-client'

async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  
  if (admin) return true
  
  // Check if user is the creator
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  return tournament?.createdById === userId
}

export default async function TournamentTestsPage({ 
  params 
}: { 
  params: Promise<{ param: string }> 
}) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Handle both Promise and direct params (Next.js 15 compatibility)
  const tournamentId = resolvedParams.param

  // Check if user is tournament admin
  const isAdmin = await isTournamentAdmin(session.user.id, tournamentId)
  
  if (!isAdmin) {
    redirect(`/tournaments/${tournamentId}`)
  }

  // Get tournament info
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      name: true,
      division: true,
    },
  })

  if (!tournament) {
    redirect('/tournament-listings')
  }

  // Get events for this division
  const events = await prisma.event.findMany({
    where: {
      division: tournament.division,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Get user's clubs where they are admin and match tournament division
  const memberships = await prisma.membership.findMany({
    where: {
      userId: session.user.id,
      role: Role.ADMIN,
      club: {
        division: tournament.division,
      },
    },
    include: {
      club: {
        select: {
          id: true,
          name: true,
          division: true,
        },
      },
    },
  })

  const userClubs = memberships.map(m => m.club)

  return (
    <TournamentTestsClient
      tournamentId={tournamentId}
      tournamentName={tournament.name}
      tournamentDivision={tournament.division}
      events={events}
      userClubs={userClubs}
      user={session.user}
    />
  )
}

