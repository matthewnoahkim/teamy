import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDevAccess } from '@/lib/dev/guard'

// DELETE - Clear all tournaments (dev only). Protected by requireDevAccess.
export async function DELETE(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/tournaments/clear')
  if (!guard.allowed) return guard.response

  try {
    // Delete related records first due to foreign key constraints
    await prisma.tournamentTest.deleteMany({})
    await prisma.tournamentEventSelection.deleteMany({})
    await prisma.tournamentRegistration.deleteMany({})
    await prisma.tournamentAdmin.deleteMany({})

    // Then delete tournaments
    const result = await prisma.tournament.deleteMany({})

    return NextResponse.json({
      success: true,
      deletedCount: result.count
    })
  } catch (error) {
    console.error('Error clearing tournaments:', error)
    return NextResponse.json(
      { error: 'Failed to clear tournaments' },
      { status: 500 }
    )
  }
}

