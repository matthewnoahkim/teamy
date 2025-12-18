import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { TournamentDetailClient } from '@/components/tournament-detail-client'
import { TournamentPageClient } from '@/components/tournament-page-client'

interface Props {
  params: { param: string }
}

export default async function TournamentPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  const { param } = params

  // First, try to find a tournament by ID (for registration view)
  const tournament = await prisma.tournament.findUnique({
    where: { id: param },
    select: { id: true }
  })

  if (tournament) {
    // This is a tournament ID - show registration/detail view
    if (!session?.user) {
      redirect('/login')
    }

    // Get user's clubs with teams for registration - only clubs where user is admin
    const memberships = await prisma.membership.findMany({
      where: { 
        userId: session.user.id,
        role: Role.ADMIN,
      },
      include: {
        club: {
          include: {
            teams: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Get unique clubs
    const uniqueClubs = new Map()
    for (const membership of memberships) {
      if (!uniqueClubs.has(membership.club.id)) {
        uniqueClubs.set(membership.club.id, {
          id: membership.club.id,
          name: membership.club.name,
          division: membership.club.division,
          teams: membership.club.teams || [],
        })
      }
    }

    const clubsWithTeams = Array.from(uniqueClubs.values())

    return <TournamentDetailClient tournamentId={param} userTeams={clubsWithTeams} user={session.user} />
  }

  // Not a tournament ID - try to find by slug (public tournament page)
  const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
    where: {
      OR: [
        { preferredSlug: param },
        { 
          tournamentName: {
            equals: param.replace(/-/g, ' '),
            mode: 'insensitive'
          }
        }
      ],
      status: 'APPROVED'
    },
    include: {
      tournament: true,
    }
  })

  if (!hostingRequest) {
    notFound()
  }

  // Check if user is the tournament director (they can see unpublished)
  const isDirector = session?.user?.email?.toLowerCase() === hostingRequest.directorEmail.toLowerCase()

  // Check if tournament is published (or user is director)
  if (!hostingRequest.tournament?.published && !isDirector) {
    notFound()
  }

  // Get user's clubs if logged in (for registration)
  let userClubs: { id: string; name: string; division: string; teams: { id: string; name: string }[] }[] = []
  if (session?.user) {
    const memberships = await prisma.membership.findMany({
      where: { 
        userId: session.user.id,
        role: Role.ADMIN,
      },
      include: {
        club: {
          include: {
            teams: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    const uniqueClubs = new Map()
    for (const membership of memberships) {
      if (!uniqueClubs.has(membership.club.id)) {
        uniqueClubs.set(membership.club.id, {
          id: membership.club.id,
          name: membership.club.name,
          division: membership.club.division,
          teams: membership.club.teams || [],
        })
      }
    }
    userClubs = Array.from(uniqueClubs.values())
  }

  // Serialize tournament data
  // Use hosting request division for display (supports "B&C")
  const displayDivision = hostingRequest.division || hostingRequest.tournament?.division || 'C'
  const serializedTournament = hostingRequest.tournament ? {
    id: hostingRequest.tournament.id,
    name: hostingRequest.tournament.name,
    slug: hostingRequest.tournament.slug,
    division: displayDivision,
    description: hostingRequest.tournament.description,
    isOnline: hostingRequest.tournament.isOnline,
    startDate: hostingRequest.tournament.startDate.toISOString(),
    endDate: hostingRequest.tournament.endDate.toISOString(),
    startTime: hostingRequest.tournament.startTime.toISOString(),
    endTime: hostingRequest.tournament.endTime.toISOString(),
    location: hostingRequest.tournament.location,
    price: hostingRequest.tournament.price,
    additionalTeamPrice: hostingRequest.tournament.additionalTeamPrice,
    feeStructure: hostingRequest.tournament.feeStructure,
    registrationStartDate: hostingRequest.tournament.registrationStartDate?.toISOString() || null,
    registrationEndDate: hostingRequest.tournament.registrationEndDate?.toISOString() || null,
    earlyBirdDiscount: hostingRequest.tournament.earlyBirdDiscount,
    earlyBirdDeadline: hostingRequest.tournament.earlyBirdDeadline?.toISOString() || null,
    lateFee: hostingRequest.tournament.lateFee,
    lateFeeStartDate: hostingRequest.tournament.lateFeeStartDate?.toISOString() || null,
    eligibilityRequirements: hostingRequest.tournament.eligibilityRequirements,
    eventsRun: hostingRequest.tournament.eventsRun,
  } : null

  return (
    <TournamentPageClient 
      hostingRequest={hostingRequest}
      tournament={serializedTournament}
      isDirector={isDirector}
      user={session?.user}
      userClubs={userClubs}
    />
  )
}

