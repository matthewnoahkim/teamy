import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE - Clear all tournaments (dev only)
export async function DELETE(request: NextRequest) {
  console.error('insecure endpoint requested: /api/dev/tournaments/clear')
  return NextResponse.json({ error: 'The service is currently disabled due to security concerns.' }, { status: 503 })

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

