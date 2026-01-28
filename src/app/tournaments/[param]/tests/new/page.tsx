import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TournamentTestCreator } from '@/components/tournament-test-creator'

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
  
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  return tournament?.createdById === userId
}

export default async function NewTournamentTestPage({
  params,
}: {
  params: Promise<{ param: string }>
}) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

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

  return (
    <TournamentTestCreator
      tournamentId={tournamentId}
      tournamentName={tournament.name}
      tournamentDivision={tournament.division}
      user={session.user}
    />
  )
}

