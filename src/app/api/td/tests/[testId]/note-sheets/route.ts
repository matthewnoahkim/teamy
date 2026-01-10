import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasESTestAccess, isTournamentAdmin } from '@/lib/rbac'

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
    let isESTest = false

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
        isESTest = true
      }
    }

    if (!tournamentId) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user has access to this test
    // For ES tests, use hasESTestAccess (TDs have full access, ES only for their assigned events)
    // For regular tests, check tournament admin
    if (isESTest) {
      const hasAccess = await hasESTestAccess(session.user.id, session.user.email || '', testId)
      const isAdmin = await isTournamentAdmin(session.user.id, tournamentId)
      if (!hasAccess && !isAdmin) {
        return NextResponse.json(
          { error: 'Not authorized to view note sheets for this test' },
          { status: 403 }
        )
      }
    } else {
      // For regular tests, check tournament admin
      const isAdmin = await isTournamentAdmin(session.user.id, tournamentId)
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Only tournament admins can view note sheets' },
          { status: 403 }
        )
      }
    }

    // Get all note sheets for this test (handle both Test and ESTest)
    const noteSheets = await prisma.noteSheet.findMany({
      where: isESTest
        ? { esTestId: testId }
        : { testId: testId },
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
