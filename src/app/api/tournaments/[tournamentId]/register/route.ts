import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serverSession } from '@/lib/server-session'
import { Division, Role } from '@prisma/client'
import { z } from 'zod'

const trialEventSelectionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  division: z.enum(['B', 'C']).optional(),
})

const memberAssignmentSchema = z.object({
  membershipId: z.string(),
  eventIds: z.array(z.string()).optional(),
  trialEventSelections: z.array(trialEventSelectionSchema).optional(),
})

// Schema for bulk registration (legacy)
const bulkRegisterSchema = z.object({
  registrations: z.array(
    z.object({
      clubId: z.string(),
      teamId: z.string().optional(),
      subclubId: z.string().optional(),
      eventIds: z.array(z.string()).optional(),
      trialEventSelections: z.array(trialEventSelectionSchema).optional(),
      memberAssignments: z.array(memberAssignmentSchema).optional(),
    })
  ).min(1, 'At least one team must be registered'),
})

// Schema for simple registration (new tournament page)
const simpleRegisterSchema = z.object({
  clubId: z.string(),
  teamIds: z.array(z.string()).min(1, 'At least one team must be selected'),
  teamSelections: z.record(
    z.string(),
    z.object({
      eventIds: z.array(z.string()).optional(),
      trialEventSelections: z.array(trialEventSelectionSchema).optional(),
      memberAssignments: z.array(memberAssignmentSchema).optional(),
    })
  ).optional(),
})

type RequestedTrialEventSelection = {
  name: string
  division?: 'B' | 'C'
}

type NormalizedTrialEventSelection = {
  name: string
  division: 'B' | 'C'
}

type RegistrationMemberAssignment = {
  membershipId: string
  eventIds: string[]
  trialEventSelections: RequestedTrialEventSelection[]
}

type RegistrationPayload = {
  clubId: string
  teamId?: string
  eventIds: string[]
  trialEventSelections: RequestedTrialEventSelection[]
  memberAssignments: RegistrationMemberAssignment[]
}

function normalizeDivision(value: string | null | undefined, fallback: Division): 'B' | 'C' {
  if (value === 'B' || value === 'C') return value
  return fallback
}

function normalizeStringArray(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return []
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)))
}

function dedupeTrialSelections(
  selections: RequestedTrialEventSelection[]
): RequestedTrialEventSelection[] {
  const seen = new Set<string>()
  const deduped: RequestedTrialEventSelection[] = []

  for (const selection of selections) {
    const trimmedName = selection.name.trim()
    if (!trimmedName) continue
    const key = `${trimmedName.toLowerCase()}::${selection.division ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push({
      name: trimmedName,
      division: selection.division,
    })
  }

  return deduped
}

function mergeMemberAssignments(
  assignments: Array<{
    membershipId: string
    eventIds?: string[]
    trialEventSelections?: RequestedTrialEventSelection[]
  }> | undefined
): RegistrationMemberAssignment[] {
  if (!assignments || assignments.length === 0) return []

  const merged = new Map<
    string,
    {
      eventIds: Set<string>
      trialEvents: RequestedTrialEventSelection[]
      trialKeys: Set<string>
    }
  >()

  for (const assignment of assignments) {
    if (!assignment.membershipId) continue
    const existing = merged.get(assignment.membershipId) ?? {
      eventIds: new Set<string>(),
      trialEvents: [],
      trialKeys: new Set<string>(),
    }

    for (const eventId of normalizeStringArray(assignment.eventIds)) {
      existing.eventIds.add(eventId)
    }

    for (const trialSelection of dedupeTrialSelections(assignment.trialEventSelections ?? [])) {
      const trialKey = `${trialSelection.name.toLowerCase()}::${trialSelection.division ?? ''}`
      if (existing.trialKeys.has(trialKey)) continue
      existing.trialKeys.add(trialKey)
      existing.trialEvents.push(trialSelection)
    }

    merged.set(assignment.membershipId, existing)
  }

  return Array.from(merged.entries()).map(([membershipId, value]) => ({
    membershipId,
    eventIds: Array.from(value.eventIds),
    trialEventSelections: value.trialEvents,
  }))
}

function parseTournamentTrialEvents(
  raw: string | null,
  fallbackDivision: Division
): NormalizedTrialEventSelection[] {
  if (!raw || !raw.trim()) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const seen = new Set<string>()
    const normalized: NormalizedTrialEventSelection[] = []

    for (const item of parsed) {
      if (typeof item === 'string') {
        const name = item.trim()
        if (!name) continue
        const division = normalizeDivision(undefined, fallbackDivision)
        const key = `${name.toLowerCase()}::${division}`
        if (seen.has(key)) continue
        seen.add(key)
        normalized.push({ name, division })
        continue
      }

      if (item && typeof item === 'object' && 'name' in item) {
        const name = String(item.name ?? '').trim()
        if (!name) continue
        const division = normalizeDivision(
          'division' in item ? String(item.division ?? '') : undefined,
          fallbackDivision
        )
        const key = `${name.toLowerCase()}::${division}`
        if (seen.has(key)) continue
        seen.add(key)
        normalized.push({ name, division })
      }
    }

    return normalized
  } catch {
    return []
  }
}

function normalizeRequestedTrialEvents(
  requested: RequestedTrialEventSelection[],
  availableTrialEvents: NormalizedTrialEventSelection[],
  fallbackDivision: Division
): { normalized: NormalizedTrialEventSelection[]; error?: string } {
  if (requested.length === 0) return { normalized: [] }

  const availableByName = new Map<string, NormalizedTrialEventSelection[]>()
  for (const event of availableTrialEvents) {
    const key = event.name.toLowerCase()
    const list = availableByName.get(key) ?? []
    list.push(event)
    availableByName.set(key, list)
  }

  const normalized: NormalizedTrialEventSelection[] = []
  const seen = new Set<string>()

  for (const trial of requested) {
    const trimmedName = trial.name.trim()
    const loweredName = trimmedName.toLowerCase()
    const matching = availableByName.get(loweredName) ?? []

    if (matching.length === 0) {
      return { normalized: [], error: `Invalid trial event selection: ${trimmedName}` }
    }

    let resolvedDivision: 'B' | 'C'
    if (trial.division === 'B' || trial.division === 'C') {
      const explicitMatch = matching.find((m) => m.division === trial.division)
      if (!explicitMatch) {
        return {
          normalized: [],
          error: `Trial event "${trimmedName}" is not available for Division ${trial.division}`,
        }
      }
      resolvedDivision = trial.division
    } else if (matching.length === 1) {
      resolvedDivision = matching[0].division
    } else {
      resolvedDivision = normalizeDivision(undefined, fallbackDivision)
      const fallbackMatch = matching.find((m) => m.division === resolvedDivision)
      if (!fallbackMatch) {
        return { normalized: [], error: `Trial event "${trimmedName}" requires a division` }
      }
    }

    const key = `${trimmedName.toLowerCase()}::${resolvedDivision}`
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push({ name: trimmedName, division: resolvedDivision })
  }

  return { normalized }
}

// POST /api/tournaments/[tournamentId]/register
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = resolvedParams
    const body = await req.json()

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        division: true,
        trialEvents: true,
        hostingRequest: {
          select: {
            division: true,
          },
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const registrationDivision = tournament.hostingRequest?.division
    const allowedDivisions: Division[] =
      registrationDivision === 'B&C' ? [Division.B, Division.C] : [tournament.division]
    const availableTrialEvents = parseTournamentTrialEvents(tournament.trialEvents, tournament.division)

    let registrationsToProcess: RegistrationPayload[] = []

    // Try simple schema first (new format from tournament page)
    const simpleResult = simpleRegisterSchema.safeParse(body)
    if (simpleResult.success) {
      registrationsToProcess = simpleResult.data.teamIds.map((teamId) => {
        const selection = simpleResult.data.teamSelections?.[teamId]
        return {
          clubId: simpleResult.data.clubId,
          teamId,
          eventIds: normalizeStringArray(selection?.eventIds),
          trialEventSelections: dedupeTrialSelections(
            (selection?.trialEventSelections ?? []).map((trialEvent) => ({
              name: trialEvent.name,
              division: trialEvent.division,
            }))
          ),
          memberAssignments: mergeMemberAssignments(selection?.memberAssignments),
        }
      })
    } else {
      // Try bulk schema (legacy format)
      const bulkResult = bulkRegisterSchema.safeParse(body)
      if (bulkResult.success) {
        registrationsToProcess = bulkResult.data.registrations.map((registration) => ({
          clubId: registration.clubId,
          teamId: registration.teamId || registration.subclubId,
          eventIds: normalizeStringArray(registration.eventIds),
          trialEventSelections: dedupeTrialSelections(
            (registration.trialEventSelections ?? []).map((trialEvent) => ({
              name: trialEvent.name,
              division: trialEvent.division,
            }))
          ),
          memberAssignments: mergeMemberAssignments(registration.memberAssignments),
        }))
      } else {
        return NextResponse.json(
          { error: 'Invalid input', details: simpleResult.error.issues },
          { status: 400 }
        )
      }
    }

    // Validate and normalize all registrations
    for (const registration of registrationsToProcess) {
      const teamId = registration.teamId

      // Verify user is an admin of the club
      const adminMembership = await prisma.membership.findUnique({
        where: {
          userId_clubId: {
            userId: session.user.id,
            clubId: registration.clubId,
          },
        },
        select: {
          id: true,
          role: true,
          club: { select: { name: true } },
        },
      })
      if (!adminMembership) {
        return NextResponse.json(
          { error: `You must be a member of club ${registration.clubId}` },
          { status: 403 }
        )
      }

      if (adminMembership.role !== Role.ADMIN) {
        return NextResponse.json(
          { error: `You must be an admin of ${adminMembership.club.name} to register for tournaments` },
          { status: 403 }
        )
      }

      let teamMemberIds = new Set<string>()
      if (teamId) {
        const team = await prisma.team.findFirst({
          where: {
            id: teamId,
            clubId: registration.clubId,
          },
          select: {
            id: true,
          },
        })
        if (!team) {
          return NextResponse.json({ error: 'Team does not belong to the specified club' }, { status: 400 })
        }

        const teamMembers = await prisma.membership.findMany({
          where: {
            clubId: registration.clubId,
            teamId,
          },
          select: {
            id: true,
          },
        })
        teamMemberIds = new Set(teamMembers.map((member) => member.id))
      } else if (registration.memberAssignments.length > 0) {
        return NextResponse.json(
          { error: 'Member assignments require a specific team registration' },
          { status: 400 }
        )
      }

      // Check if already registered (with same team if specified)
      const existingRegistration = await prisma.tournamentRegistration.findFirst({
        where: {
          tournamentId,
          clubId: registration.clubId,
          teamId: teamId ?? null,
        },
      })

      if (existingRegistration) {
        const club = await prisma.club.findUnique({
          where: { id: registration.clubId },
          select: { name: true },
        })
        const team = teamId
          ? await prisma.team.findUnique({
              where: { id: teamId },
              select: { name: true },
            })
          : null

        const registrationName = team
          ? `${club?.name || 'Club'} - ${team.name}`
          : club?.name || 'This club'

        return NextResponse.json(
          { error: `${registrationName} is already registered for this tournament` },
          { status: 400 }
        )
      }

      // Merge team-level and member-level selections so team selections always cover assigned members.
      const memberAssignedEventIds = new Set<string>()
      const memberAssignedTrialSelections: RequestedTrialEventSelection[] = []
      for (const assignment of registration.memberAssignments) {
        for (const eventId of assignment.eventIds) {
          memberAssignedEventIds.add(eventId)
        }
        memberAssignedTrialSelections.push(...assignment.trialEventSelections)
      }
      registration.eventIds = Array.from(
        new Set([...registration.eventIds, ...Array.from(memberAssignedEventIds)])
      )
      registration.trialEventSelections = dedupeTrialSelections([
        ...registration.trialEventSelections,
        ...memberAssignedTrialSelections,
      ])

      if (registration.eventIds.length > 0) {
        const events = await prisma.event.findMany({
          where: {
            id: { in: registration.eventIds },
            division: { in: allowedDivisions },
          },
          select: { id: true },
        })

        if (events.length !== new Set(registration.eventIds).size) {
          return NextResponse.json(
            { error: 'Some events are invalid or do not match tournament division' },
            { status: 400 }
          )
        }
      }

      if (registration.trialEventSelections.length > 0) {
        if (availableTrialEvents.length === 0) {
          return NextResponse.json(
            { error: 'This tournament does not have trial events enabled' },
            { status: 400 }
          )
        }

        const normalizedTeamTrialSelection = normalizeRequestedTrialEvents(
          registration.trialEventSelections,
          availableTrialEvents,
          tournament.division
        )

        if (normalizedTeamTrialSelection.error) {
          return NextResponse.json({ error: normalizedTeamTrialSelection.error }, { status: 400 })
        }

        registration.trialEventSelections = normalizedTeamTrialSelection.normalized
      }

      if (registration.eventIds.length === 0 && registration.trialEventSelections.length === 0) {
        return NextResponse.json(
          { error: 'Each team registration must include at least one event or trial event selection' },
          { status: 400 }
        )
      }

      // Validate and normalize member-level assignments
      const allowedEventIds = new Set(registration.eventIds)
      const allowedTrialKeys = new Set(
        registration.trialEventSelections.map(
          (selection) => `${selection.name.toLowerCase()}::${selection.division}`
        )
      )

      const normalizedMemberAssignments: RegistrationMemberAssignment[] = []
      for (const assignment of registration.memberAssignments) {
        if (teamMemberIds.size > 0 && !teamMemberIds.has(assignment.membershipId)) {
          return NextResponse.json(
            { error: 'One or more assigned members are not on the selected team' },
            { status: 400 }
          )
        }

        const assignmentEventIds = Array.from(new Set(assignment.eventIds))
        for (const eventId of assignmentEventIds) {
          if (!allowedEventIds.has(eventId)) {
            return NextResponse.json(
              { error: 'Assigned member includes an event not selected for the team' },
              { status: 400 }
            )
          }
        }

        const normalizedAssignmentTrialSelection = normalizeRequestedTrialEvents(
          assignment.trialEventSelections,
          availableTrialEvents,
          tournament.division
        )

        if (normalizedAssignmentTrialSelection.error) {
          return NextResponse.json(
            { error: normalizedAssignmentTrialSelection.error },
            { status: 400 }
          )
        }

        for (const trialSelection of normalizedAssignmentTrialSelection.normalized) {
          const key = `${trialSelection.name.toLowerCase()}::${trialSelection.division}`
          if (!allowedTrialKeys.has(key)) {
            return NextResponse.json(
              { error: 'Assigned member includes a trial event not selected for the team' },
              { status: 400 }
            )
          }
        }

        if (
          assignmentEventIds.length === 0 &&
          normalizedAssignmentTrialSelection.normalized.length === 0
        ) {
          continue
        }

        normalizedMemberAssignments.push({
          membershipId: assignment.membershipId,
          eventIds: assignmentEventIds,
          trialEventSelections: normalizedAssignmentTrialSelection.normalized,
        })
      }

      if (teamId && normalizedMemberAssignments.length === 0) {
        return NextResponse.json(
          { error: 'Assign at least one team member to at least one event before registering' },
          { status: 400 }
        )
      }

      registration.memberAssignments = normalizedMemberAssignments
    }

    // Create all registrations
    const registrations = await Promise.all(
      registrationsToProcess.map((registration) => {
        const teamId = registration.teamId

        const memberEventAssignments = registration.memberAssignments.flatMap((assignment) =>
          assignment.eventIds.map((eventId) => ({
            membershipId: assignment.membershipId,
            eventId,
          }))
        )
        const memberTrialAssignments = registration.memberAssignments.flatMap((assignment) =>
          assignment.trialEventSelections.map((trialEvent) => ({
            membershipId: assignment.membershipId,
            eventName: trialEvent.name,
            eventDivision: normalizeDivision(trialEvent.division, tournament.division),
          }))
        )

        return prisma.tournamentRegistration.create({
          data: {
            tournamentId,
            clubId: registration.clubId,
            teamId: teamId ?? null,
            registeredById: session.user.id,
            status: 'CONFIRMED',
            ...(registration.eventIds.length > 0
              ? {
                  eventSelections: {
                    create: registration.eventIds.map((eventId) => ({
                      eventId,
                    })),
                  },
                }
              : {}),
            ...(registration.trialEventSelections.length > 0
              ? {
                  trialEventSelections: {
                    create: registration.trialEventSelections.map((trialEvent) => ({
                      eventName: trialEvent.name,
                      eventDivision: normalizeDivision(trialEvent.division, tournament.division),
                    })),
                  },
                }
              : {}),
            ...(memberEventAssignments.length > 0
              ? {
                  memberEventAssignments: {
                    create: memberEventAssignments,
                  },
                }
              : {}),
            ...(memberTrialAssignments.length > 0
              ? {
                  memberTrialEventAssignments: {
                    create: memberTrialAssignments,
                  },
                }
              : {}),
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
            trialEventSelections: {
              select: {
                eventName: true,
                eventDivision: true,
              },
            },
            memberEventAssignments: {
              select: {
                membershipId: true,
                eventId: true,
              },
            },
            memberTrialEventAssignments: {
              select: {
                membershipId: true,
                eventName: true,
                eventDivision: true,
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
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}
