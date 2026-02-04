import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Division, Role } from '@prisma/client'

const updateTournamentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  division: z.enum(['B', 'C']).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  paymentInstructions: z.string().optional(),
  isOnline: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().optional(),
  approved: z.boolean().optional(),
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

// GET /api/tournaments/[tournamentId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  console.error('insecure endpoint requested: /api/tournaments/[tournamentId] (GET)')
  return NextResponse.json({ error: 'The service is currently disabled due to security concerns.' }, { status: 503 })

  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: resolvedParams.tournamentId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        admins: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        registrations: {
          include: {
            club: {
              select: {
                id: true,
                name: true,
                division: true,
                memberships: {
                  where: {
                    role: Role.ADMIN,
                  },
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
            team: {
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
            registeredBy: {
              select: {
                id: true,
                name: true,
                email: true,
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
            _count: {
              select: {
                eventSelections: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TypeScript narrowing: we know tournament and session are not null after checks
    // Use non-null assertions since we've already checked
    const tournamentData = tournament!
    const userSession = session!

    // Get hosting request division if available (supports "B&C")
    let displayDivision = tournamentData.division
    if (tournamentData.hostingRequestId) {
      const hostingRequest = await prisma.tournamentHostingRequest.findUnique({
        where: { id: tournamentData.hostingRequestId ?? undefined },
        select: { division: true },
      })
      const division = hostingRequest?.division
      if (division) {
        displayDivision = division as 'B' | 'C' // Use hosting request division for display
      }
    }

    // Override division for display
    const tournamentWithDisplayDivision = {
      ...tournamentData,
      division: displayDivision ?? tournamentData.division,
    }

    const isAdmin = await isTournamentAdmin(userSession.user.id, resolvedParams.tournamentId)
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Tournament ${resolvedParams.tournamentId}] User ${userSession.user.id} isAdmin: ${isAdmin}`)
    }

    return NextResponse.json({ tournament: tournamentWithDisplayDivision, isAdmin })
  } catch (err: unknown) {
    console.error('Get tournament error:', err)
    let errorMessage = 'Unknown error'
    if (err instanceof Error) {
      errorMessage = (err as Error).message
    } else if (typeof err === 'string') {
      errorMessage = err as string
    } else if (err !== null && err !== undefined) {
      try {
        errorMessage = JSON.stringify(err)
      } catch {
        errorMessage = 'Unknown error'
      }
    }
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 })
  }
}

// PUT /api/tournaments/[tournamentId]
export async function PUT(
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
      return NextResponse.json({ error: 'Only tournament admins can update tournaments' }, { status: 403 })
    }

    const body = await req.json()
    const validated = updateTournamentSchema.parse(body)

    const updateData: any = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.division !== undefined) updateData.division = validated.division as Division
    if (validated.description !== undefined) updateData.description = validated.description
    if (validated.price !== undefined) updateData.price = validated.price
    if (validated.paymentInstructions !== undefined) updateData.paymentInstructions = validated.paymentInstructions
    if (validated.isOnline !== undefined) updateData.isOnline = validated.isOnline
    if (validated.startDate !== undefined) updateData.startDate = new Date(validated.startDate)
    if (validated.endDate !== undefined) updateData.endDate = new Date(validated.endDate)
    if (validated.startTime !== undefined) updateData.startTime = new Date(validated.startTime)
    if (validated.endTime !== undefined) updateData.endTime = new Date(validated.endTime)
    if (validated.location !== undefined) updateData.location = validated.location
    if (validated.approved !== undefined) updateData.approved = validated.approved

    const tournament = await prisma.tournament.update({
      where: { id: resolvedParams.tournamentId },
      data: updateData,
    })

    return NextResponse.json({ tournament })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Update tournament error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tournaments/[tournamentId]
export async function DELETE(
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
      return NextResponse.json({ error: 'Only tournament admins can delete tournaments' }, { status: 403 })
    }

    await prisma.tournament.delete({
      where: { id: resolvedParams.tournamentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete tournament error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
