import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Division } from '@prisma/client'

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
  // Note: 'approved' is intentionally excluded - only platform admins can approve tournaments via the dev panel
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
// Disabled: this endpoint is not yet secured for public use.
export async function GET() {
  console.error('insecure endpoint requested: /api/tournaments/[tournamentId] (GET)')
  return NextResponse.json({ error: 'The service is currently disabled due to security concerns.' }, { status: 503 })
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

    const updateData: Record<string, unknown> = {}
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
