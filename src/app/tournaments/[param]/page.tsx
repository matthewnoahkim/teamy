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

  // First, try to find a tournament by ID
  const tournamentById = await prisma.tournament.findUnique({
    where: { id: param },
    include: {
      hostingRequest: true,
    }
  })

  if (tournamentById) {
    // If tournament has a slug, redirect to the slug-based URL for consistency
    if (tournamentById.slug) {
      redirect(`/tournaments/${tournamentById.slug}`)
    }
    
    // If tournament has a hosting request with a slug, use that
    if (tournamentById.hostingRequest?.preferredSlug) {
      redirect(`/tournaments/${tournamentById.hostingRequest.preferredSlug}`)
    }
    
    // No slug available - show the tournament page directly without requiring login
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

    // Tournament accessed by ID must have a hosting request to be valid
    if (!tournamentById.hostingRequest) {
      notFound()
    }

    // Check if user is the tournament director
    const isDirector = session?.user?.email?.toLowerCase() === tournamentById.hostingRequest.directorEmail.toLowerCase()

    // Check if user is a tournament admin
    let isTournamentAdmin = false
    if (session?.user?.id) {
      const admin = await prisma.tournamentAdmin.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: tournamentById.id,
            userId: session.user.id,
          },
        },
      })
      isTournamentAdmin = !!admin || isDirector
    }

    // Check if tournament is published (or user is director)
    if (!tournamentById.published && !isDirector) {
      notFound()
    }

    // Use hosting request division for display (supports "B&C")
    const displayDivision = tournamentById.hostingRequest.division || tournamentById.division || 'C'
    const serializedTournament = {
      id: tournamentById.id,
      name: tournamentById.name,
      slug: tournamentById.slug,
      division: displayDivision,
      description: tournamentById.description,
      isOnline: tournamentById.isOnline,
      startDate: tournamentById.startDate.toISOString(),
      endDate: tournamentById.endDate.toISOString(),
      startTime: tournamentById.startTime.toISOString(),
      endTime: tournamentById.endTime.toISOString(),
      location: tournamentById.location,
      price: tournamentById.price,
      additionalTeamPrice: tournamentById.additionalTeamPrice,
      feeStructure: tournamentById.feeStructure,
      registrationStartDate: tournamentById.registrationStartDate?.toISOString() || null,
      registrationEndDate: tournamentById.registrationEndDate?.toISOString() || null,
      earlyBirdDiscount: tournamentById.earlyBirdDiscount,
      earlyBirdDeadline: tournamentById.earlyBirdDeadline?.toISOString() || null,
      lateFee: tournamentById.lateFee,
      lateFeeStartDate: tournamentById.lateFeeStartDate?.toISOString() || null,
      eligibilityRequirements: tournamentById.eligibilityRequirements,
      eventsRun: tournamentById.eventsRun,
      trialEvents: tournamentById.trialEvents,
    }

    // Load page content
    let initialSections: Array<{ id: string; type: string; title: string; content: string }> | undefined = undefined
    if (tournamentById.hostingRequest.pageContent) {
      try {
        initialSections = JSON.parse(tournamentById.hostingRequest.pageContent)
      } catch (e) {
        console.error('Error parsing page content:', e)
      }
    }

    // Check if user is registered and if tests are available
    let isRegistered = false
    let hasAvailableTests = false
    if (session?.user?.id) {
      // Get user memberships
      const memberships = await prisma.membership.findMany({
        where: { userId: session.user.id },
        select: { id: true, teamId: true, clubId: true },
      })

      const teamIds = memberships.map((m) => m.teamId).filter((id): id is string => id !== null)
      const clubIds = memberships.map((m) => m.clubId)

      // Check if user is registered
      const registration = await prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId: tournamentById.id,
          status: 'CONFIRMED',
          OR: [
            { teamId: { in: teamIds } },
            { clubId: { in: clubIds } },
          ],
        },
      })

      if (registration) {
        isRegistered = true

        // Check if there are tests available during the testing window
        const now = new Date()
        
        // Get membership that matches registration
        const matchingMembership = registration.teamId
          ? memberships.find((m) => m.clubId === registration.clubId && m.teamId === registration.teamId)
          : memberships.find((m) => m.clubId === registration.clubId)

        if (matchingMembership) {
          // Get event assignments
          const rosterAssignments = await prisma.rosterAssignment.findMany({
            where: {
              membershipId: matchingMembership.id,
            },
            select: { eventId: true },
          })
          const eventIds = rosterAssignments.map((ra) => ra.eventId)

          // Get published tests
          const [tournamentTests, esTests] = await Promise.all([
            prisma.tournamentTest.findMany({
              where: {
                tournamentId: tournamentById.id,
                OR: eventIds.length === 0
                  ? [{}]
                  : [{ eventId: { in: eventIds } }, { eventId: null }],
              },
              include: {
                test: {
                  select: {
                    status: true,
                    startAt: true,
                    endAt: true,
                    allowLateUntil: true,
                    durationMinutes: true,
                  },
                },
              },
            }),
            prisma.eSTest.findMany({
              where: {
                tournamentId: tournamentById.id,
                status: 'PUBLISHED',
                OR: eventIds.length === 0
                  ? [{}]
                  : [{ eventId: { in: eventIds } }, { eventId: null }],
              },
              select: {
                startAt: true,
                endAt: true,
                allowLateUntil: true,
                durationMinutes: true,
              },
            }),
          ])

          // Check if any tests are currently available
          const allTests = [
            ...tournamentTests.filter((tt) => tt.test.status === 'PUBLISHED').map((tt) => ({
              startAt: tt.test.startAt,
              endAt: tt.test.endAt,
              allowLateUntil: tt.test.allowLateUntil,
              durationMinutes: tt.test.durationMinutes,
            })),
            ...esTests,
          ]

          hasAvailableTests = allTests.some((test) => {
            if (!test.startAt) return false
            const startAt = test.startAt instanceof Date ? test.startAt : new Date(test.startAt)
            const endAt = test.endAt ? (test.endAt instanceof Date ? test.endAt : new Date(test.endAt)) : null
            const allowLateUntil = test.allowLateUntil
              ? test.allowLateUntil instanceof Date
                ? test.allowLateUntil
                : new Date(test.allowLateUntil)
              : null
            const effectiveEnd = allowLateUntil || endAt || new Date(startAt.getTime() + (test.durationMinutes || 60) * 60000)
            return now >= startAt && now <= effectiveEnd
          })
        }
      }
    }

    return (
      <TournamentPageClient 
        hostingRequest={tournamentById.hostingRequest}
        tournament={serializedTournament}
        isDirector={isDirector}
        isTournamentAdmin={isTournamentAdmin}
        user={session?.user}
        userClubs={userClubs}
        initialSections={initialSections}
        isRegistered={isRegistered}
        hasAvailableTests={hasAvailableTests}
      />
    )
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

  // Check if user is a tournament admin
  let isTournamentAdmin = false
  if (session?.user?.id && hostingRequest.tournament) {
    const admin = await prisma.tournamentAdmin.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: hostingRequest.tournament.id,
          userId: session.user.id,
        },
      },
    })
    isTournamentAdmin = !!admin || isDirector
  }

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
    trialEvents: hostingRequest.tournament.trialEvents,
  } : null

  // Load page content
  let initialSections: Array<{ id: string; type: string; title: string; content: string }> | undefined = undefined
  if (hostingRequest.pageContent) {
    try {
      initialSections = JSON.parse(hostingRequest.pageContent)
    } catch (e) {
      console.error('Error parsing page content:', e)
    }
  }

  // Check if user is registered and if tests are available
  let isRegistered = false
  let hasAvailableTests = false
  if (session?.user?.id && hostingRequest.tournament) {
    // Get user memberships
    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      select: { id: true, teamId: true, clubId: true },
    })

    const teamIds = memberships.map((m) => m.teamId).filter((id): id is string => id !== null)
    const clubIds = memberships.map((m) => m.clubId)

    // Check if user is registered
    const registration = await prisma.tournamentRegistration.findFirst({
      where: {
        tournamentId: hostingRequest.tournament.id,
        status: 'CONFIRMED',
        OR: [
          { teamId: { in: teamIds } },
          { clubId: { in: clubIds } },
        ],
      },
    })

    if (registration) {
      isRegistered = true

      // Check if there are tests available during the testing window
      const now = new Date()
      
      // Get membership that matches registration
      const matchingMembership = registration.teamId
        ? memberships.find((m) => m.clubId === registration.clubId && m.teamId === registration.teamId)
        : memberships.find((m) => m.clubId === registration.clubId)

      if (matchingMembership) {
        // Get event assignments
        const rosterAssignments = await prisma.rosterAssignment.findMany({
          where: {
            membershipId: matchingMembership.id,
          },
          select: { eventId: true },
        })
        const eventIds = rosterAssignments.map((ra) => ra.eventId)

        // Get published tests
        const [tournamentTests, esTests] = await Promise.all([
          prisma.tournamentTest.findMany({
            where: {
              tournamentId: hostingRequest.tournament.id,
              OR: eventIds.length === 0
                ? [{}]
                : [{ eventId: { in: eventIds } }, { eventId: null }],
            },
            include: {
              test: {
                select: {
                  status: true,
                  startAt: true,
                  endAt: true,
                  allowLateUntil: true,
                  durationMinutes: true,
                },
              },
            },
          }),
          prisma.eSTest.findMany({
            where: {
              tournamentId: hostingRequest.tournament.id,
              status: 'PUBLISHED',
              OR: eventIds.length === 0
                ? [{}]
                : [{ eventId: { in: eventIds } }, { eventId: null }],
            },
            select: {
              startAt: true,
              endAt: true,
              allowLateUntil: true,
              durationMinutes: true,
            },
          }),
        ])

        // Check if any tests are currently available
        const allTests = [
          ...tournamentTests.filter((tt) => tt.test.status === 'PUBLISHED').map((tt) => ({
            startAt: tt.test.startAt,
            endAt: tt.test.endAt,
            allowLateUntil: tt.test.allowLateUntil,
            durationMinutes: tt.test.durationMinutes,
          })),
          ...esTests,
        ]

        hasAvailableTests = allTests.some((test) => {
          if (!test.startAt) return false
          const startAt = test.startAt instanceof Date ? test.startAt : new Date(test.startAt)
          const endAt = test.endAt ? (test.endAt instanceof Date ? test.endAt : new Date(test.endAt)) : null
          const allowLateUntil = test.allowLateUntil
            ? test.allowLateUntil instanceof Date
              ? test.allowLateUntil
              : new Date(test.allowLateUntil)
            : null
          const effectiveEnd = allowLateUntil || endAt || new Date(startAt.getTime() + (test.durationMinutes || 60) * 60000)
          return now >= startAt && now <= effectiveEnd
        })
      }
    }
  }

  return (
    <TournamentPageClient 
      hostingRequest={hostingRequest}
      tournament={serializedTournament}
      isDirector={isDirector}
      isTournamentAdmin={isTournamentAdmin}
      user={session?.user}
      userClubs={userClubs}
      initialSections={initialSections}
      isRegistered={isRegistered}
      hasAvailableTests={hasAvailableTests}
    />
  )
}

