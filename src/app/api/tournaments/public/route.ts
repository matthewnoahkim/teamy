import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public endpoint to get approved upcoming tournaments (no auth required)
// GET /api/tournaments/public
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const division = searchParams.get('division') as 'B' | 'C' | null

    const where: Record<string, unknown> = {
      approved: true,
      published: true, // Only show published tournaments
      // Show all tournaments (past and upcoming)
    }

    if (division) {
      where.division = division
    }

    const tournaments = await prisma.tournament.findMany({
      where,
      include: {
        hostingRequest: {
          select: {
            division: true,
            tournamentLevel: true,
            tournamentFormat: true,
            directorName: true,
            directorEmail: true,
            preferredSlug: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc', // Show most recent first
      },
      // No limit - show all tournaments
    })

    // Use hosting request division for display if available (supports "B&C")
    const tournamentsWithDisplayDivision = tournaments.map(t => ({
      ...t,
      division: (t.hostingRequest?.division || t.division) as string,
    }))

    return NextResponse.json({ tournaments: tournamentsWithDisplayDivision })
  } catch (error) {
    console.error('Get public tournaments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

