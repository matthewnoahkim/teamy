import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/tournaments/check-slug?slug=example
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const slug = searchParams.get('slug')

    if (!slug || slug.trim() === '') {
      return NextResponse.json({ available: true })
    }

    // Check if slug is taken in Tournament table
    const tournament = await prisma.tournament.findUnique({
      where: { slug: slug.trim() },
      select: { id: true },
    })

    // Check if slug is already requested in TournamentHostingRequest table
    const hostingRequest = await prisma.tournamentHostingRequest.findFirst({
      where: { 
        preferredSlug: slug.trim(),
        status: { not: 'REJECTED' }, // Don't count rejected requests
      },
      select: { id: true },
    })

    const available = !tournament && !hostingRequest

    return NextResponse.json({ 
      available,
      message: available 
        ? 'This slug is available' 
        : 'This slug is already taken. Please choose a different one.',
    })
  } catch (error) {
    console.error('Error checking slug availability:', error)
    return NextResponse.json(
      { error: 'Failed to check slug availability' },
      { status: 500 }
    )
  }
}
