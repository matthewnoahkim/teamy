import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addTestSchema = z.object({
  testId: z.string(),
  eventId: z.string().optional(),
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

// GET /api/tournaments/[tournamentId]/tests
export async function GET(
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
      return NextResponse.json({ error: 'Only tournament admins can view tests' }, { status: 403 })
    }

    const tournamentTests = await prisma.tournamentTest.findMany({
      where: { tournamentId: resolvedParams.tournamentId },
      include: {
        test: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            durationMinutes: true,
            startAt: true,
            endAt: true,
            allowLateUntil: true,
            requireFullscreen: true,
            allowCalculator: true,
            calculatorType: true,
            maxAttempts: true,
            clubId: true,
            club: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                questions: true,
                attempts: true,
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    return NextResponse.json({ tests: tournamentTests })
  } catch (error) {
    console.error('Get tournament tests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tournaments/[tournamentId]/tests
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
      return NextResponse.json({ error: 'Only tournament admins can add tests' }, { status: 403 })
    }

    const body = await req.json()
    const validated = addTestSchema.parse(body)

    // Verify test exists
    const test = await prisma.test.findUnique({
      where: { id: validated.testId },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // If eventId is provided, verify it exists and matches tournament division
    if (validated.eventId) {
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
    }

    // Check if already added
    const existing = await prisma.tournamentTest.findUnique({
      where: {
        tournamentId_testId: {
          tournamentId: resolvedParams.tournamentId,
          testId: validated.testId,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Test is already added to this tournament' }, { status: 400 })
    }

    const tournamentTest = await prisma.tournamentTest.create({
      data: {
        tournamentId: resolvedParams.tournamentId,
        testId: validated.testId,
        eventId: validated.eventId,
      },
      include: {
        test: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            durationMinutes: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    return NextResponse.json({ test: tournamentTest })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Add tournament test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tournaments/[tournamentId]/tests
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
      return NextResponse.json({ error: 'Only tournament admins can remove tests' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const testId = searchParams.get('testId')

    if (!testId) {
      return NextResponse.json({ error: 'testId is required' }, { status: 400 })
    }

    await prisma.tournamentTest.delete({
      where: {
        tournamentId_testId: {
          tournamentId: resolvedParams.tournamentId,
          testId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove tournament test error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

