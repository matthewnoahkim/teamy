import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
  
  if (admin) return true
  
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  return tournament?.createdById === userId
}

// GET - Get all note sheets for a test (tournament admin view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> | { testId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params if it's a Promise (Next.js 15 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params
    const testId = resolvedParams.testId

    // Try to find as regular Test first
    let test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        club: {
          select: {
            id: true,
          },
        },
      },
    })

    let tournamentId: string | null = null

    if (test) {
      // Find tournament via TournamentTest
      const tournamentTest = await prisma.tournamentTest.findFirst({
        where: { testId: test.id },
        select: {
          tournamentId: true,
        },
      })
      tournamentId = tournamentTest?.tournamentId || null
    } else {
      // Try to find as ESTest
      const esTest = await prisma.eSTest.findUnique({
        where: { id: testId },
        select: {
          tournamentId: true,
          allowNoteSheet: true,
        },
      })

      if (esTest) {
        tournamentId = esTest.tournamentId
        // ESTest doesn't support note sheets in the database yet
        return NextResponse.json({ noteSheets: [] })
      }
    }

    if (!test || !tournamentId) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user is tournament admin
    const isAdmin = await isTournamentAdmin(session.user.id, tournamentId)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only tournament admins can view note sheets' },
        { status: 403 }
      )
    }

    // Get all note sheets for this test
    const noteSheets = await prisma.noteSheet.findMany({
      where: {
        testId: testId,
      },
      include: {
        membership: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
            club: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        reviewer: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ noteSheets })
  } catch (error) {
    console.error('Get note sheets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
