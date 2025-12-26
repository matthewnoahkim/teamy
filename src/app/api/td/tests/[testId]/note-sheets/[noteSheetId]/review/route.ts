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
  { params }: { params: Promise<{ testId: string; noteSheetId: string }> | { testId: string; noteSheetId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params if it's a Promise (Next.js 15 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params
    const { testId, noteSheetId } = resolvedParams

    const body = await req.json()
    const validatedData = reviewNoteSheetSchema.parse(body)

    // Get the note sheet
    const noteSheet = await prisma.noteSheet.findUnique({
      where: { id: noteSheetId },
      include: {
        test: true,
      },
    })

    if (!noteSheet) {
      return NextResponse.json({ error: 'Note sheet not found' }, { status: 404 })
    }

    if (noteSheet.testId !== testId) {
      return NextResponse.json(
        { error: 'Note sheet does not belong to this test' },
        { status: 400 }
      )
    }

    // Find tournament via TournamentTest
    const tournamentTest = await prisma.tournamentTest.findFirst({
      where: { testId: noteSheet.testId },
      select: {
        tournamentId: true,
      },
    })

    if (!tournamentTest) {
      return NextResponse.json(
        { error: 'Test is not associated with a tournament' },
        { status: 400 }
      )
    }

    // Check if user is tournament admin
    const isAdmin = await isTournamentAdmin(session.user.id, tournamentTest.tournamentId)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only tournament admins can review note sheets' },
        { status: 403 }
      )
    }

    // Get reviewer's membership (for audit trail)
    // Find a membership for the reviewer in the test's club
    const reviewerMembership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        clubId: noteSheet.test.clubId,
      },
    })

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
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Review note sheet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
