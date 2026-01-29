import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; attemptId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }



    const test = await prisma.test.findUnique({
      where: { id: resolvedParams.testId },
      select: { clubId: true },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    const isAdminUser = await isAdmin(session.user.id, test.clubId)
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Only admins can view AI suggestions' }, { status: 403 })
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: resolvedParams.attemptId },
      select: { testId: true },
    })

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    if (attempt.testId !== resolvedParams.testId) {
      return NextResponse.json({ error: 'Attempt does not belong to this test' }, { status: 400 })
    }

    const suggestions = await prisma.aiGradingSuggestion.findMany({
      where: { attemptId: resolvedParams.attemptId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      suggestions: suggestions.map((suggestion) => ({
        id: suggestion.id,
        answerId: suggestion.answerId,
        questionId: suggestion.questionId,
        suggestedPoints: Number(suggestion.suggestedPoints),
        maxPoints: Number(suggestion.maxPoints),
        explanation: suggestion.explanation,
        strengths: suggestion.strengths,
        gaps: suggestion.gaps,
        rubricAlignment: suggestion.rubricAlignment,
        status: suggestion.status,
        createdAt: suggestion.createdAt.toISOString(),
        updatedAt: suggestion.updatedAt.toISOString(),
        acceptedAt: suggestion.acceptedAt?.toISOString() || null,
        acceptedPoints: suggestion.acceptedPoints ? Number(suggestion.acceptedPoints) : null,
        rawResponse: suggestion.rawResponse, // Include rawResponse for part suggestions
      })),
    })
  } catch (error) {
    console.error('AI suggestions fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to load AI suggestions' },
      { status: 500 }
    )
  }
}


