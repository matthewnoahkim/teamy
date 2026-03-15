import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasESTestAccess } from '@/lib/rbac'

// POST /api/es/tests/[testId]/attempts/[attemptId]/reassign
// Deletes an attempt so the student can retake the test.
// Requires ES or TD access to the test.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string; attemptId: string }> }
) {
  const { testId, attemptId } = await params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await hasESTestAccess(session.user.id, session.user.email, testId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized to reassign this attempt' }, { status: 403 })
    }

    const attempt = await prisma.eSTestAttempt.findUnique({
      where: { id: attemptId },
      select: { testId: true },
    })

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    if (attempt.testId !== testId) {
      return NextResponse.json({ error: 'Attempt does not belong to this test' }, { status: 400 })
    }

    await prisma.eSTestAttempt.delete({ where: { id: attemptId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reassign ES attempt error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
