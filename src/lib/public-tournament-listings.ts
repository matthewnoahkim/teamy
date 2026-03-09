import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const publicApprovedTournamentSelect = {
  id: true,
  tournamentName: true,
  tournamentLevel: true,
  division: true,
  tournamentFormat: true,
  location: true,
  preferredSlug: true,
  otherNotes: true,
  status: true,
  createdAt: true,
  tournament: {
    select: {
      id: true,
      published: true,
    },
  },
} satisfies Prisma.TournamentHostingRequestSelect

export type PublicApprovedTournament = Prisma.TournamentHostingRequestGetPayload<{
  select: typeof publicApprovedTournamentSelect
}>

export type PublicApprovedTournamentFilters = {
  division?: 'all' | 'B' | 'C'
  level?: 'all' | 'invitational' | 'regional' | 'state' | 'national'
  search?: string
}

export async function getPublicApprovedTournamentRequests(
  filters: PublicApprovedTournamentFilters = {},
) {
  if (!process.env.DATABASE_URL) {
    return [] as PublicApprovedTournament[]
  }

  const where: Prisma.TournamentHostingRequestWhereInput = {
    status: 'APPROVED',
  }

  if (filters.division && filters.division !== 'all') {
    where.division = {
      contains: filters.division,
    }
  }

  if (filters.level && filters.level !== 'all') {
    where.tournamentLevel = filters.level
  }

  if (filters.search) {
    where.OR = [
      {
        tournamentName: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
      {
        location: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
    ]
  }

  try {
    return await prisma.tournamentHostingRequest.findMany({
      where,
      select: publicApprovedTournamentSelect,
      orderBy: { createdAt: 'desc' },
    })
  } catch (error) {
    console.error('Failed to load public approved tournament requests:', error)
    return [] as PublicApprovedTournament[]
  }
}
