import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership } from '@/lib/rbac'
import { Role } from '@prisma/client'
import { z } from 'zod'

// Schema for bulk registration (legacy)
const bulkRegisterSchema = z.object({
  registrations: z.array(z.object({
    clubId: z.string(),
    teamId: z.string().optional(),
    subclubId: z.string().optional(),
    eventIds: z.array(z.string()).optional(),
  })).min(1, 'At least one team must be registered'),
})

// Schema for simple registration (new tournament page)
const simpleRegisterSchema = z.object({
  clubId: z.string(),
  teamIds: z.array(z.string()).min(1, 'At least one team must be selected'),
})

// POST /api/tournaments/[tournamentId]/register
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

    const { tournamentId } = resolvedParams
    const body = await req.json()
    
    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Determine which schema to use based on input format
    let registrationsToProcess: Array<{ clubId: string; teamId?: string; eventIds?: string[] }> = []
    
    // Try simple schema first (new format from tournament page)
    const simpleResult = simpleRegisterSchema.safeParse(body)
    if (simpleResult.success) {
      // Convert simple format to registrations array
      registrationsToProcess = simpleResult.data.teamIds.map(teamId => ({
        clubId: simpleResult.data.clubId,
        teamId,
        eventIds: [], // No event selection in simple format
      }))
    } else {
      // Try bulk schema (legacy format)
      const bulkResult = bulkRegisterSchema.safeParse(body)
      if (bulkResult.success) {
        registrationsToProcess = bulkResult.data.registrations.map(reg => ({
          clubId: reg.clubId,
          teamId: reg.teamId || reg.subclubId,
          eventIds: reg.eventIds || [],
        }))
      } else {
        return NextResponse.json({ error: 'Invalid input', details: simpleResult.error.issues }, { status: 400 })
      }
    }

    // Validate all registrations
    for (const reg of registrationsToProcess) {
      const teamId = reg.teamId
      
      // Verify user is an admin of the club
      const membership = await getUserMembership(session.user.id, reg.clubId)
      if (!membership) {
        return NextResponse.json({ error: `You must be a member of club ${reg.clubId}` }, { status: 403 })
      }
      
      // Check if user is an admin
      if (membership.role !== Role.ADMIN) {
        return NextResponse.json({ 
          error: `You must be an admin of ${membership.club.name} to register for tournaments` 
        }, { status: 403 })
      }

      // If teamId is provided, verify it belongs to the club
      if (teamId) {
        const team = await prisma.team.findFirst({
          where: {
            id: teamId,
            clubId: reg.clubId,
          },
        })
        if (!team) {
          return NextResponse.json({ error: 'Team does not belong to the specified club' }, { status: 400 })
        }
      }

      // Check if already registered (with same team if specified)
      const existingRegistration = await prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId: resolvedParams.tournamentId,
          clubId: reg.clubId,
          teamId: teamId ?? null,
        },
      })

      if (existingRegistration) {
        const club = await prisma.club.findUnique({
          where: { id: reg.clubId },
          select: { name: true },
        })
        const team = teamId ? await prisma.team.findUnique({
          where: { id: teamId },
          select: { name: true },
        }) : null
        
        const registrationName = team 
          ? `${club?.name || 'Club'} - ${team.name}`
          : club?.name || 'This club'
        
        return NextResponse.json({ 
          error: `${registrationName} is already registered for this tournament` 
        }, { status: 400 })
      }

      // Verify all events exist and match tournament division (only if eventIds provided)
      if (reg.eventIds && reg.eventIds.length > 0) {
        const events = await prisma.event.findMany({
          where: {
            id: { in: reg.eventIds },
            division: tournament.division,
          },
        })

        if (events.length !== reg.eventIds.length) {
          return NextResponse.json({ error: 'Some events are invalid or do not match tournament division' }, { status: 400 })
        }
      }
    }

    // Create all registrations
    const registrations = await Promise.all(
      registrationsToProcess.map(reg => {
        const teamId = reg.teamId
        
        return prisma.tournamentRegistration.create({
          data: {
            tournamentId,
            clubId: reg.clubId,
            teamId: teamId ?? null,
            registeredById: session.user.id,
            status: 'CONFIRMED',
            // Only create event selections if eventIds are provided
            ...(reg.eventIds && reg.eventIds.length > 0 ? {
              eventSelections: {
                create: reg.eventIds.map(eventId => ({
                  eventId,
                })),
              },
            } : {}),
          },
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
            eventSelections: {
              include: {
                event: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        })
      })
    )

    return NextResponse.json({ registrations })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Register for tournament error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack })
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 })
  }
}
