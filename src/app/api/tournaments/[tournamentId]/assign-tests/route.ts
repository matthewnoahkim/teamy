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
  return !!admin
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
      include: {
        club: {
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (registrations.length === 0) {
      return NextResponse.json({ 
        message: 'No teams registered for this event',
        assigned: 0 
      })
    }

    // For each registered team, assign the test to all members who have this event in their roster
    let totalAssignments = 0

    await prisma.$transaction(async (tx) => {
      for (const registration of registrations) {
        // Get all memberships for this team that have this event in their roster
        const membershipsWithEvent = await tx.membership.findMany({
          where: {
            teamId: registration.teamId,
            rosterAssignments: {
              some: {
                eventId: validated.eventId,
              },
            },
          },
        })

        // Create test assignments for each membership
        for (const membership of membershipsWithEvent) {
          // Check if assignment already exists
          const existing = await tx.testAssignment.findFirst({
            where: {
              testId: validated.testId,
              targetMembershipId: membership.id,
              eventId: validated.eventId,
            },
          })

          if (!existing) {
            await tx.testAssignment.create({
              data: {
                testId: validated.testId,
                assignedScope: 'PERSONAL',
                targetMembershipId: membership.id,
                eventId: validated.eventId,
              },
            })
            totalAssignments++
          }
        }
      }
    })

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

