import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import * as rbac from '@/lib/rbac'

interface EnsureTournamentDirectorStaffOptions {
  tournamentId: string
  userId: string
  userEmail: string
  userName?: string | null
}

export const tournamentDirectorStaffDeps = {
  isTournamentDirector: rbac.isTournamentDirector,
}

export async function ensureTournamentDirectorStaff({
  tournamentId,
  userId,
  userEmail,
  userName,
}: EnsureTournamentDirectorStaffOptions) {
  const normalizedEmail = userEmail.trim().toLowerCase()
  if (!normalizedEmail) {
    return null
  }

  const existingAcceptedStaff = await prisma.tournamentStaff.findFirst({
    where: {
      tournamentId,
      status: 'ACCEPTED',
      OR: [
        { userId },
        {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
        },
      ],
    },
  })

  if (existingAcceptedStaff) {
    return existingAcceptedStaff
  }

  const hasDirectorAccess = await tournamentDirectorStaffDeps.isTournamentDirector(
    userId,
    normalizedEmail,
    tournamentId,
  )
  if (!hasDirectorAccess) {
    return null
  }

  const existingInvite = await prisma.tournamentStaff.findUnique({
    where: {
      tournamentId_email: {
        tournamentId,
        email: normalizedEmail,
      },
    },
  })

  if (existingInvite) {
    return prisma.tournamentStaff.update({
      where: { id: existingInvite.id },
      data: {
        role: 'TOURNAMENT_DIRECTOR',
        status: 'ACCEPTED',
        userId,
        acceptedAt: existingInvite.acceptedAt ?? new Date(),
        name: existingInvite.name || userName || null,
      },
    })
  }

  return prisma.tournamentStaff.create({
    data: {
      tournamentId,
      email: normalizedEmail,
      name: userName || null,
      role: 'TOURNAMENT_DIRECTOR',
      status: 'ACCEPTED',
      inviteToken: nanoid(32),
      userId,
      acceptedAt: new Date(),
    },
  })
}
