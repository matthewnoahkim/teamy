import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reviewNoteSheetSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
  rejectionReason: z.string().optional(),
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
  
  if (admin) return true
  
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { createdById: true },
  })
  
  return tournament?.createdById === userId
}

// PATCH - Review note sheet (accept or reject) for tournament tests
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; noteSheetId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params if it's a Promise (Next.js 15 compatibility)
    const { testId, noteSheetId } = resolvedParams

    const body = await req.json()
    const validatedData = reviewNoteSheetSchema.parse(body)

    // Get the note sheet
    const noteSheet = await prisma.noteSheet.findUnique({
      where: { id: noteSheetId },
      include: {
        test: true,
        esTest: {
          select: {
            tournamentId: true,
          },
        },
      },
    })

    if (!noteSheet) {
      return NextResponse.json({ error: 'Note sheet not found' }, { status: 404 })
    }

    // Check if note sheet belongs to this test (handle both Test and ESTest)
    const belongsToTest = (noteSheet.testId === testId) || (noteSheet.esTestId === testId)
    if (!belongsToTest) {
      return NextResponse.json(
        { error: 'Note sheet does not belong to this test' },
        { status: 400 }
      )
    }

    let tournamentId: string | null = null

    if (noteSheet.testId) {
      // Regular Test - find tournament via TournamentTest
      const tournamentTest = await prisma.tournamentTest.findFirst({
        where: { testId: noteSheet.testId },
        select: {
          tournamentId: true,
        },
      })
      tournamentId = tournamentTest?.tournamentId || null
    } else if (noteSheet.esTestId) {
      // ESTest - get tournament directly
      tournamentId = noteSheet.esTest?.tournamentId || null
    }

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Test is not associated with a tournament' },
        { status: 400 }
      )
    }

    // Check if user is tournament admin
    const isAdmin = await isTournamentAdmin(session.user.id, tournamentId)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only tournament admins can review note sheets' },
        { status: 403 }
      )
    }

    // Get reviewer's membership (for audit trail)
    // For regular Test, find membership in the test's club
    // For ESTest, we'll use the first membership we can find for the user
    let reviewerMembership = null
    if (noteSheet.testId && noteSheet.test) {
      reviewerMembership = await prisma.membership.findFirst({
        where: {
          userId: session.user.id,
          clubId: noteSheet.test.clubId,
        },
      })
    } else {
      // For ESTest, find any membership for the user (we just need it for audit trail)
      reviewerMembership = await prisma.membership.findFirst({
        where: {
          userId: session.user.id,
        },
      })
    }

    // Update the note sheet
    const updated = await prisma.noteSheet.update({
      where: { id: noteSheetId },
      data: {
        status: validatedData.status,
        rejectionReason:
          validatedData.status === 'REJECTED'
            ? validatedData.rejectionReason || null
            : null,
        reviewedById: reviewerMembership?.id || null,
        reviewedAt: new Date(),
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
    })

    return NextResponse.json({ noteSheet: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Review note sheet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
