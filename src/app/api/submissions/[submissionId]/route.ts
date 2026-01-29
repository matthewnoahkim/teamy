import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const updateSubmissionSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  notes: z.string().optional(),
})

// PATCH - Update submission status (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const submissionId = resolvedParams.submissionId
    const body = await req.json()
    const validated = updateSubmissionSchema.parse(body)

    // Find the submission
    const existingSubmission = await prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: {
        form: true,
      },
    })

    if (!existingSubmission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Only admins can update submission status
    const isAdminUser = await isAdmin(session.user.id, existingSubmission.form.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can update submission status' },
        { status: 403 }
      )
    }

    const submission = await prisma.formSubmission.update({
      where: { id: submissionId },
      data: {
        ...validated,
        reviewedAt: validated.status ? new Date() : undefined,
        reviewedById: validated.status ? session.user.id : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({ submission })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid data', 
        details: error.issues 
      }, { status: 400 })
    }
    console.error('Update submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

