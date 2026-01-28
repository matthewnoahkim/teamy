import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin, getUserMembership } from '@/lib/rbac'
import { z } from 'zod'

const reviewNoteSheetSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
  rejectionReason: z.string().optional(),
})

// PATCH - Review note sheet (accept or reject)
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

    const body = await req.json()
    const validatedData = reviewNoteSheetSchema.parse(body)

    // Get the note sheet
    const noteSheet = await prisma.noteSheet.findUnique({
      where: { id: resolvedParams.noteSheetId },
      include: {
        test: true,
      },
    })

    if (!noteSheet) {
      return NextResponse.json({ error: 'Note sheet not found' }, { status: 404 })
    }

    if (noteSheet.testId !== resolvedParams.testId) {
      return NextResponse.json(
        { error: 'Note sheet does not belong to this test' },
        { status: 400 }
      )
    }

    if (!noteSheet.test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, noteSheet.test.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can review note sheets' },
        { status: 403 }
      )
    }

    // Get reviewer's membership
    const reviewerMembership = await getUserMembership(
      session.user.id,
      noteSheet.test.clubId
    )
    if (!reviewerMembership) {
      return NextResponse.json(
        { error: 'Reviewer membership not found' },
        { status: 404 }
      )
    }

    // Rejection reason is optional

    // Update the note sheet
    const updated = await prisma.noteSheet.update({
      where: { id: resolvedParams.noteSheetId },
      data: {
        status: validatedData.status,
        rejectionReason:
          validatedData.status === 'REJECTED'
            ? validatedData.rejectionReason || null
            : null,
        reviewedById: reviewerMembership.id,
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
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Review note sheet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

