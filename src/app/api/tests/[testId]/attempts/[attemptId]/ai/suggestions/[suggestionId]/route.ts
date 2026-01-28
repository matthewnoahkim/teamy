import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'
import { logActivity } from '@/lib/activity-log'
import { AiSuggestionStatus } from '@prisma/client'
import { z } from 'zod'

const bodySchema = z.object({
  action: z.enum(['dismiss']),
})

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ testId: string; attemptId: string; suggestionId: string }>
  }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const body = await req.json()
    const validated = bodySchema.parse(body)

    const test = await prisma.test.findUnique({
      where: { id: resolvedParams.testId },
      select: { clubId: true },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    const isAdminUser = await isAdmin(session.user.id, test.clubId)
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Only admins can update AI suggestions' }, { status: 403 })
    }

    const suggestion = await prisma.aiGradingSuggestion.findUnique({
      where: { id: resolvedParams.suggestionId },
    })

    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    if (suggestion.testId !== resolvedParams.testId || suggestion.attemptId !== resolvedParams.attemptId) {
      return NextResponse.json({ error: 'Suggestion does not belong to this attempt' }, { status: 400 })
    }

    let updatedStatus = suggestion.status

    if (validated.action === 'dismiss') {
      updatedStatus = AiSuggestionStatus.DISMISSED
    }

    const updated = await prisma.aiGradingSuggestion.update({
      where: { id: suggestion.id },
      data: { status: updatedStatus },
    })

    await logActivity({
      action: 'AI_GRADE_SUGGESTION_UPDATE',
      description: `Admin updated AI suggestion ${updated.id} to ${updated.status}`,
      userId: session.user.id,
      logType: 'ADMIN_ACTION',
      metadata: {
        testId: resolvedParams.testId,
        attemptId: resolvedParams.attemptId,
        suggestionId: updated.id,
        action: validated.action,
      },
      route: `/api/tests/${resolvedParams.testId}/attempts/${resolvedParams.attemptId}/ai/suggestions/${resolvedParams.suggestionId}`,
    })

    return NextResponse.json({
      suggestion: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('AI suggestion update error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 })
  }
}

