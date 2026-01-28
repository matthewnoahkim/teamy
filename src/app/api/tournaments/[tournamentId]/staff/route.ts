import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { sendStaffInviteEmail } from '@/lib/email'

// GET /api/tournaments/[tournamentId]/staff - List all staff
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = await params

    // Check if user is a TD or creator of the tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        admins: true,
        hostingRequest: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const isCreator = tournament.createdById === session.user.id
    const isAdmin = tournament.admins.some(a => a.userId === session.user.id)
    const isDirector = tournament.hostingRequest?.directorEmail.toLowerCase() === session.user.email?.toLowerCase()

    if (!isCreator && !isAdmin && !isDirector) {
      return NextResponse.json({ error: 'Not authorized to view staff' }, { status: 403 })
    }

    const staff = await prisma.tournamentStaff.findMany({
      where: { tournamentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        events: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                division: true,
              },
            },
          },
        },
        tests: {
          select: {
            id: true,
            name: true,
            status: true,
            eventId: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('Error fetching staff:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

// POST /api/tournaments/[tournamentId]/staff - Invite new staff
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = await params
    const body = await request.json()
    const { email, name, role, eventIds = [], trialEventNames = [] } = body as {
      email: string
      name?: string
      role: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
      eventIds?: string[]
      trialEventNames?: string[]
    }

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    // Check if user is authorized
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        admins: true,
        hostingRequest: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const isCreator = tournament.createdById === session.user.id
    const isAdmin = tournament.admins.some(a => a.userId === session.user.id)
    const isDirector = tournament.hostingRequest?.directorEmail.toLowerCase() === session.user.email?.toLowerCase()

    if (!isCreator && !isAdmin && !isDirector) {
      return NextResponse.json({ error: 'Not authorized to invite staff' }, { status: 403 })
    }

    // Check if this email is already invited
    const existingStaff = await prisma.tournamentStaff.findUnique({
      where: {
        tournamentId_email: {
          tournamentId,
          email: email.toLowerCase(),
        },
      },
    })

    if (existingStaff) {
      return NextResponse.json({ error: 'This email has already been invited' }, { status: 400 })
    }

    // Generate invite token
    const inviteToken = nanoid(32)

    // Create the staff invitation
    const staff = await prisma.tournamentStaff.create({
      data: {
        tournamentId,
        email: email.toLowerCase(),
        name,
        role,
        inviteToken,
        events: role === 'EVENT_SUPERVISOR' && eventIds && eventIds.length > 0
          ? {
              create: eventIds.map((eventId: string) => ({
                eventId,
              })),
            }
          : undefined,
        trialEvents: role === 'EVENT_SUPERVISOR' && trialEventNames && trialEventNames.length > 0
          ? JSON.stringify(trialEventNames)
          : null,
      },
      include: {
        events: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Get event names for email (including trial events)
    const eventNames = staff.events.map(e => e.event.name)
    const parsedTrialEventNames = staff.trialEvents ? JSON.parse(staff.trialEvents) as string[] : []
    const allEventNames = [...eventNames, ...parsedTrialEventNames]

    // Send invitation email
    await sendStaffInviteEmail({
      to: email.toLowerCase(),
      staffName: name,
      tournamentName: tournament.name,
      role,
      inviteToken,
      inviterName: session.user.name || 'Tournament Director',
      events: allEventNames,
    })

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('Error inviting staff:', error)
    return NextResponse.json({ error: 'Failed to invite staff' }, { status: 500 })
  }
}

// DELETE /api/tournaments/[tournamentId]/staff - Remove staff
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = await params
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 })
    }

    // Check if user is authorized
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        admins: true,
        hostingRequest: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const isCreator = tournament.createdById === session.user.id
    const isAdmin = tournament.admins.some(a => a.userId === session.user.id)
    const isDirector = tournament.hostingRequest?.directorEmail.toLowerCase() === session.user.email?.toLowerCase()

    if (!isCreator && !isAdmin && !isDirector) {
      return NextResponse.json({ error: 'Not authorized to remove staff' }, { status: 403 })
    }

    await prisma.tournamentStaff.delete({
      where: { id: staffId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing staff:', error)
    return NextResponse.json({ error: 'Failed to remove staff' }, { status: 500 })
  }
}

// PATCH /api/tournaments/[tournamentId]/staff - Update staff role/events
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tournamentId } = await params
    const body = await request.json()
    const { staffId, role, eventIds, trialEventNames } = body as {
      staffId: string
      role?: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
      eventIds?: string[]
      trialEventNames?: string[]
    }

    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 })
    }

    // Check if user is authorized
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        admins: true,
        hostingRequest: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const isCreator = tournament.createdById === session.user.id
    const isAdmin = tournament.admins.some(a => a.userId === session.user.id)
    const isDirector = tournament.hostingRequest?.directorEmail.toLowerCase() === session.user.email?.toLowerCase()

    if (!isCreator && !isAdmin && !isDirector) {
      return NextResponse.json({ error: 'Not authorized to update staff' }, { status: 403 })
    }

    // Make sure the staff member exists and belongs to this tournament
    const existingStaff = await prisma.tournamentStaff.findUnique({
      where: { id: staffId },
      select: { id: true, tournamentId: true },
    })

    if (!existingStaff || existingStaff.tournamentId !== tournamentId) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }

    const nextRole = role
    const nextEventIds = role === 'EVENT_SUPERVISOR' ? eventIds || [] : []
    const nextTrialEventNames = role === 'EVENT_SUPERVISOR' ? trialEventNames || [] : []

    const updatedStaff = await prisma.$transaction(async tx => {
      // Update role if provided
      const staffRecord = await tx.tournamentStaff.update({
        where: { id: staffId },
        data: {
          ...(nextRole && { role: nextRole }),
          // Clear ES assignments when role changes away from ES
          ...(nextRole && nextRole !== 'EVENT_SUPERVISOR' ? { 
            events: { deleteMany: {} },
            trialEvents: null,
          } : {}),
          // Update trial events if role is EVENT_SUPERVISOR
          ...(nextRole === 'EVENT_SUPERVISOR' ? {
            trialEvents: nextTrialEventNames.length > 0 ? JSON.stringify(nextTrialEventNames) : null,
          } : {}),
        },
      })

      // Replace ES event assignments when applicable
      if (nextRole === 'EVENT_SUPERVISOR') {
        await tx.eventSupervisorAssignment.deleteMany({ where: { staffId } })
        if (nextEventIds.length > 0) {
          await tx.eventSupervisorAssignment.createMany({
            data: nextEventIds.map(eventId => ({
              staffId,
              eventId,
            })),
            skipDuplicates: true,
          })
        }
      }

      return staffRecord
    })

    // Return updated staff with relations for UI refresh
    const staff = await prisma.tournamentStaff.findUnique({
      where: { id: updatedStaff.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        events: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                division: true,
              },
            },
          },
        },
        tests: {
          select: {
            id: true,
            name: true,
            status: true,
            eventId: true,
          },
        },
      },
    })

    return NextResponse.json({ staff })
  } catch (error) {
    console.error('Error updating staff:', error)
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}

