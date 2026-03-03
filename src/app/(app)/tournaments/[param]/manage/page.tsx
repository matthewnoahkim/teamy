import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TournamentManageClient } from '@/components/tournament-manage-client'

async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  // Check if user is in TournamentAdmin table
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  
  // Also check if user is the creator (creators should always have admin access)
  if (!admin) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { createdById: true },
    })
    if (tournament && tournament.createdById === userId) {
      return true
    }
  }
  
  return !!admin
}

export default async function TournamentManagePage({ params }: { params: Promise<{ param: string }> }) {
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
    // User is not an admin, redirect to tournament detail page
    redirect(`/tournaments/${tournamentId}`)
  }

  return <TournamentManageClient tournamentId={tournamentId} user={session.user} />
}

