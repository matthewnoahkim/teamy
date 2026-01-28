import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TournamentRegistrationClient } from '@/components/tournament-registration-client'

interface PageProps {
  params: Promise<{ param: string }>
}

export default async function TournamentRegistrationPage({ params }: PageProps) {
  const resolvedParams = await params
  const session = await getServerSession(authOptions)
  const { param } = resolvedParams

  // Find tournament by slug or ID
  let tournament = await prisma.tournament.findFirst({
    where: {
      OR: [
        { slug: param },
        { id: param },
      ],
    },
    include: {
      registrations: {
        include: {
          club: {
            select: {
              id: true,
              name: true,
              division: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
          registeredBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      hostingRequest: {
        select: {
          id: true,
          tournamentName: true,
          division: true,
          directorName: true,
          directorEmail: true,
        },
      },
    },
  })

  // If not found by direct lookup, try finding via hosting request
  if (!tournament) {
    const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
      where: {
        OR: [
          { preferredSlug: param },
          { id: param },
        ],
        status: 'APPROVED',
      },
      include: {
        tournament: {
          include: {
            registrations: {
              include: {
                club: {
                  select: {
                    id: true,
                    name: true,
                    division: true,
                  },
                },
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                registeredBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            hostingRequest: {
              select: {
                id: true,
                tournamentName: true,
                division: true,
                directorName: true,
                directorEmail: true,
              },
            },
          },
        },
      },
    })

    if (hostingRequest?.tournament) {
      tournament = hostingRequest.tournament
    }
  }

  if (!tournament) {
    notFound()
  }

  // Get user's clubs if logged in
  let userClubs: Array<{
    id: string
    name: string
    division: string
    teams: { id: string; name: string }[]
  }> = []

  if (session?.user?.id) {
    const memberships = await prisma.membership.findMany({
      where: {
        userId: session.user.id,
        role: 'ADMIN',
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

  // Serialize dates and data
  const displayDivision = tournament.hostingRequest?.division || tournament.division || 'C'
  
  const serializedTournament = {
    id: tournament.id,
    name: tournament.name,
    slug: tournament.slug,
    division: displayDivision,
    description: tournament.description,
    isOnline: tournament.isOnline,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
    location: tournament.location,
    price: tournament.price,
    additionalTeamPrice: tournament.additionalTeamPrice,
    feeStructure: tournament.feeStructure,
    registrationStartDate: tournament.registrationStartDate?.toISOString() || null,
    registrationEndDate: tournament.registrationEndDate?.toISOString() || null,
    earlyBirdDiscount: tournament.earlyBirdDiscount,
    earlyBirdDeadline: tournament.earlyBirdDeadline?.toISOString() || null,
    lateFee: tournament.lateFee,
    lateFeeStartDate: tournament.lateFeeStartDate?.toISOString() || null,
    eligibilityRequirements: tournament.eligibilityRequirements,
    directorName: tournament.hostingRequest?.directorName || null,
    directorEmail: tournament.hostingRequest?.directorEmail || null,
  }

  const serializedRegistrations = tournament.registrations.map(reg => ({
    id: reg.id,
    status: reg.status,
    paid: reg.paid,
    createdAt: reg.createdAt.toISOString(),
    club: reg.club,
    team: reg.team,
    registeredBy: reg.registeredBy,
  }))

  return (
    <TournamentRegistrationClient
      tournament={serializedTournament}
      registrations={serializedRegistrations}
      user={session?.user}
      userClubs={userClubs}
    />
  )
}
