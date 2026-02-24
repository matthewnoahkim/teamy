import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const assignTestsSchema = z.object({
  eventId: z.string(),
  testId: z.string(),
})

// Helper to check if user is tournament admin
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

// POST /api/tournaments/[tournamentId]/assign-tests
// Bulk assign a test to all teams registered for a specific event
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is tournament admin
    const isAdmin = await isTournamentAdmin(session.user.id, resolvedParams.tournamentId)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only tournament admins can assign tests' }, { status: 403 })
    }

    const body = await req.json()
    const validated = assignTestsSchema.parse(body)

    // Verify test exists and is linked to tournament
    const tournamentTest = await prisma.tournamentTest.findUnique({
      where: {
        tournamentId_testId: {
          tournamentId: resolvedParams.tournamentId,
          testId: validated.testId,
        },
      },
      include: {
        test: true,
      },
    })

    if (!tournamentTest) {
      return NextResponse.json({ error: 'Test not found or not linked to this tournament' }, { status: 404 })
    }

    // Verify event exists and matches tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: resolvedParams.tournamentId },
      select: { division: true },
    })

    const event = await prisma.event.findUnique({
      where: { id: validated.eventId },
      select: { division: true },
    })

    if (!event || event.division !== tournament?.division) {
      return NextResponse.json({ error: 'Event does not match tournament division' }, { status: 400 })
    }

    // Get all teams registered for this tournament that selected this event
    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId: resolvedParams.tournamentId,
        status: 'CONFIRMED',
        eventSelections: {
          some: {
            eventId: validated.eventId,
          },
        },
      },
      select: {
        teamId: true,
        clubId: true,
      },
    })

    if (registrations.length === 0) {
      return NextResponse.json({ 
        message: 'No teams registered for this event',
        assigned: 0 
      })
    }

    const teamIds = registrations
      .map((registration) => registration.teamId)
      .filter((id): id is string => id !== null)
    const clubIds = registrations
      .filter((registration) => registration.teamId === null)
      .map((registration) => registration.clubId)

    if (teamIds.length === 0 && clubIds.length === 0) {
      return NextResponse.json({
        message: 'No eligible registrations found for this event',
        assigned: 0,
        teams: registrations.length,
      })
    }

    const membershipScopeWhere =
      teamIds.length > 0 && clubIds.length > 0
        ? { OR: [{ teamId: { in: teamIds } }, { clubId: { in: clubIds } }] }
        : teamIds.length > 0
          ? { teamId: { in: teamIds } }
          : { clubId: { in: clubIds } }

    // Pull all eligible memberships in one query instead of N+1 per registration.
    const membershipsWithEvent = await prisma.membership.findMany({
      where: {
        ...membershipScopeWhere,
        rosterAssignments: {
          some: {
            eventId: validated.eventId,
          },
        },
      },
      select: { id: true },
    })

    const membershipIds = membershipsWithEvent.map((membership) => membership.id)
    if (membershipIds.length === 0) {
      return NextResponse.json({
        message: 'No rostered members found for this event',
        assigned: 0,
        teams: registrations.length,
      })
    }

    const existingAssignments = await prisma.testAssignment.findMany({
      where: {
        testId: validated.testId,
        eventId: validated.eventId,
        targetMembershipId: { in: membershipIds },
      },
      select: { targetMembershipId: true },
    })
    const existingMembershipIds = new Set(
      existingAssignments
        .map((assignment) => assignment.targetMembershipId)
        .filter((id): id is string => id !== null)
    )

    const assignmentsToCreate = membershipIds
      .filter((membershipId) => !existingMembershipIds.has(membershipId))
      .map((membershipId) => ({
        testId: validated.testId,
        assignedScope: 'PERSONAL' as const,
        targetMembershipId: membershipId,
        eventId: validated.eventId,
      }))

    if (assignmentsToCreate.length > 0) {
      await prisma.testAssignment.createMany({
        data: assignmentsToCreate,
      })
    }

    const totalAssignments = assignmentsToCreate.length

    return NextResponse.json({ 
      message: `Test assigned to ${totalAssignments} team members`,
      assigned: totalAssignments,
      teams: registrations.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Assign tournament tests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

