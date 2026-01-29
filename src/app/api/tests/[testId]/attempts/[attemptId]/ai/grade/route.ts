import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership, isAdmin } from '@/lib/rbac'
import { logActivity } from '@/lib/activity-log'
import { requestFrqSuggestion } from '@/lib/ai-grading'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const requestSchema = z.object({
  mode: z.enum(['single', 'all']).default('single'),
  answerId: z.string().optional(),
  partIndex: z.number().optional(), // For multipart FRQs, specify which part to grade
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; attemptId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const body = await req.json().catch(() => ({}))
    const validated = requestSchema.parse(body)

    const test = await prisma.test.findUnique({
      where: { id: resolvedParams.testId },
      select: { clubId: true },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    const isAdminUser = await isAdmin(session.user.id, test.clubId)
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Only admins can request AI grading' }, { status: 403 })
    }

    const adminMembership = await getUserMembership(session.user.id, test.clubId)

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: resolvedParams.attemptId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    })

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    if (attempt.testId !== resolvedParams.testId) {
      return NextResponse.json({ error: 'Attempt does not belong to this test' }, { status: 400 })
    }

    const frqAnswers = attempt.answers.filter(
      (answer) => answer.question.type === 'SHORT_TEXT' || answer.question.type === 'LONG_TEXT'
    )

    if (frqAnswers.length === 0) {
      return NextResponse.json({ error: 'No FRQ answers available for AI grading' }, { status: 400 })
    }

    let targets = frqAnswers
    if (validated.mode === 'single') {
      if (!validated.answerId) {
        return NextResponse.json({ error: 'answerId is required for single mode' }, { status: 400 })
      }
      const targetAnswer = frqAnswers.find((answer) => answer.id === validated.answerId)
      if (!targetAnswer) {
        return NextResponse.json({ error: 'FRQ answer not found' }, { status: 404 })
      }
      targets = [targetAnswer]
    }

    await logActivity({
      action: 'AI_GRADE_REQUEST',
      description: `Admin requested AI grade suggestions for ${targets.length} FRQ(s)`,
      userId: session.user.id,
      logType: 'ADMIN_ACTION',
      metadata: {
        testId: resolvedParams.testId,
        attemptId: resolvedParams.attemptId,
        answerIds: targets.map((answer) => answer.id),
        mode: validated.mode,
      },
      route: `/api/tests/${resolvedParams.testId}/attempts/${resolvedParams.attemptId}/ai/grade`,
    })

    const suggestions = []

    for (const answer of targets) {
      const promptMd = answer.question.promptMd || ''
      const frqPartsMatch = promptMd.match(/---FRQ_PARTS---\n\n([\s\S]+)$/)
      
      // Check if this is a multipart FRQ
      if (frqPartsMatch && answer.answerText) {
        // Parse FRQ parts
        const partsText = frqPartsMatch[1]
        const partRegex = /\[PART:([a-z]):(\d+(?:\.\d+)?)\]\n([\s\S]*?)(?=\n\n\[PART:|$)/g
        const frqParts: Array<{ label: string; points: number; prompt: string }> = []
        let match
        
        while ((match = partRegex.exec(partsText)) !== null) {
          frqParts.push({
            label: match[1],
            points: parseFloat(match[2]),
            prompt: match[3].trim(),
          })
        }
        
        if (frqParts.length > 0) {
          // Parse student's answer (stored as "part1 | part2 | part3")
          const partAnswers = answer.answerText.split(' | ')
          
          // Check for existing suggestion to merge with
          const existingSuggestion = await prisma.aiGradingSuggestion.findFirst({
            where: {
              answerId: answer.id,
              attemptId: resolvedParams.attemptId,
            },
            orderBy: { createdAt: 'desc' },
          })
          
          // Get existing part suggestions if any
          let existingPartSuggestions: any[] = []
          if (existingSuggestion?.rawResponse && typeof existingSuggestion.rawResponse === 'object' && 'isMultipart' in existingSuggestion.rawResponse && existingSuggestion.rawResponse.isMultipart) {
            const rawResponse = existingSuggestion.rawResponse as any
            if (rawResponse.partSuggestions && Array.isArray(rawResponse.partSuggestions)) {
              existingPartSuggestions = rawResponse.partSuggestions
            }
          }
          
          // Create a map of existing part suggestions by index
          const existingByIndex = new Map(existingPartSuggestions.map((p: any) => [p.partIndex, p]))
          
          const partSuggestions: any[] = []
          
          // Grade all parts or just the specified part
          for (let i = 0; i < frqParts.length; i++) {
            const part = frqParts[i]
            const partAnswer = partAnswers[i] || ''
            
            // If partIndex is specified, only grade that part (use existing for others)
            if (validated.partIndex !== undefined && i !== validated.partIndex) {
              // Use existing suggestion for this part if available
              if (existingByIndex.has(i)) {
                partSuggestions.push(existingByIndex.get(i))
              } else {
                // No existing suggestion, create a placeholder
                partSuggestions.push({
                  partIndex: i,
                  partLabel: part.label,
                  partPoints: part.points,
                  suggestedScore: null,
                  maxScore: part.points,
                  summary: null,
                  strengths: null,
                  gaps: null,
                  rubricAlignment: null,
                })
              }
              continue
            }
            
            // Grade this part
            const partSuggestion = await requestFrqSuggestion({
              questionPrompt: part.prompt,
              rubric: answer.question.explanation || 'No rubric provided.',
              maxPoints: part.points,
              studentResponse: partAnswer,
            })
            
            partSuggestions.push({
              partIndex: i,
              partLabel: part.label,
              partPoints: part.points,
              suggestedScore: partSuggestion.suggestedScore,
              maxScore: part.points,
              summary: partSuggestion.summary,
              strengths: partSuggestion.strengths,
              gaps: partSuggestion.gaps,
              rubricAlignment: partSuggestion.rubricAlignment,
            })
          }
          
          // Sort part suggestions by index to ensure correct order
          partSuggestions.sort((a, b) => a.partIndex - b.partIndex)
          
          // Calculate total suggested points (only count parts that have been graded)
          const totalSuggestedPoints = partSuggestions.reduce((sum, p) => {
            return sum + (p.suggestedScore !== null && p.suggestedScore !== undefined ? p.suggestedScore : 0)
          }, 0)
          
          // Update existing suggestion or create new one
          let saved
          if (existingSuggestion) {
            saved = await prisma.aiGradingSuggestion.update({
              where: { id: existingSuggestion.id },
              data: {
                suggestedPoints: new Prisma.Decimal(totalSuggestedPoints),
                maxPoints: new Prisma.Decimal(Number(answer.question.points)),
                explanation: partSuggestions.filter(p => p.summary).length === 1 
                  ? partSuggestions.find(p => p.summary)?.summary || ''
                  : `Multi-part grading: ${partSuggestions.filter(p => p.summary).map(p => `Part ${p.partLabel} - ${p.suggestedScore}/${p.partPoints} points`).join(', ')}`,
                strengths: partSuggestions.filter(p => p.strengths).map(p => `Part ${p.partLabel}: ${p.strengths || 'N/A'}`).join('\n\n'),
                gaps: partSuggestions.filter(p => p.gaps).map(p => `Part ${p.partLabel}: ${p.gaps || 'N/A'}`).join('\n\n'),
                rubricAlignment: partSuggestions.filter(p => p.rubricAlignment).map(p => `Part ${p.partLabel}: ${p.rubricAlignment || 'N/A'}`).join('\n\n'),
                rawResponse: {
                  isMultipart: true,
                  partSuggestions,
                  ...partSuggestions.reduce((acc, p, idx) => {
                    acc[`part${idx}`] = p
                    return acc
                  }, {} as any),
                } as any,
              },
            })
          } else {
            saved = await prisma.aiGradingSuggestion.create({
              data: {
                testId: resolvedParams.testId,
                attemptId: resolvedParams.attemptId,
                answerId: answer.id,
                questionId: answer.questionId,
                requestedByUserId: session.user.id,
                requestedByMembershipId: adminMembership?.id,
                suggestedPoints: new Prisma.Decimal(totalSuggestedPoints),
                maxPoints: new Prisma.Decimal(Number(answer.question.points)),
                explanation: partSuggestions.filter(p => p.summary).length === 1 
                  ? partSuggestions.find(p => p.summary)?.summary || ''
                  : `Multi-part grading: ${partSuggestions.filter(p => p.summary).map(p => `Part ${p.partLabel} - ${p.suggestedScore}/${p.partPoints} points`).join(', ')}`,
                strengths: partSuggestions.filter(p => p.strengths).map(p => `Part ${p.partLabel}: ${p.strengths || 'N/A'}`).join('\n\n'),
                gaps: partSuggestions.filter(p => p.gaps).map(p => `Part ${p.partLabel}: ${p.gaps || 'N/A'}`).join('\n\n'),
                rubricAlignment: partSuggestions.filter(p => p.rubricAlignment).map(p => `Part ${p.partLabel}: ${p.rubricAlignment || 'N/A'}`).join('\n\n'),
                rawResponse: {
                  isMultipart: true,
                  partSuggestions,
                  ...partSuggestions.reduce((acc, p, idx) => {
                    acc[`part${idx}`] = p
                    return acc
                  }, {} as any),
                } as any,
              },
            })
          }
          
          suggestions.push({
            id: saved.id,
            answerId: saved.answerId,
            questionId: saved.questionId,
            suggestedPoints: Number(saved.suggestedPoints),
            maxPoints: Number(saved.maxPoints),
            explanation: saved.explanation,
            strengths: saved.strengths,
            gaps: saved.gaps,
            rubricAlignment: saved.rubricAlignment,
            status: saved.status,
            createdAt: saved.createdAt.toISOString(),
            partSuggestions: partSuggestions, // Return all parts (graded and ungraded)
          })
        } else {
          // Fall back to regular single-part grading
          const maxPoints = Number(answer.question.points)
          const aiSuggestion = await requestFrqSuggestion({
            questionPrompt: answer.question.promptMd,
            rubric: answer.question.explanation,
            maxPoints,
            studentResponse: answer.answerText,
          })

          const saved = await prisma.aiGradingSuggestion.create({
            data: {
              testId: resolvedParams.testId,
              attemptId: resolvedParams.attemptId,
              answerId: answer.id,
              questionId: answer.questionId,
              requestedByUserId: session.user.id,
              requestedByMembershipId: adminMembership?.id,
              suggestedPoints: new Prisma.Decimal(aiSuggestion.suggestedScore),
              maxPoints: new Prisma.Decimal(aiSuggestion.maxScore || maxPoints),
              explanation: aiSuggestion.summary,
              strengths: aiSuggestion.strengths,
              gaps: aiSuggestion.gaps,
              rubricAlignment: aiSuggestion.rubricAlignment,
              rawResponse: aiSuggestion.rawResponse,
            },
          })

          suggestions.push({
            id: saved.id,
            answerId: saved.answerId,
            questionId: saved.questionId,
            suggestedPoints: Number(saved.suggestedPoints),
            maxPoints: Number(saved.maxPoints),
            explanation: saved.explanation,
            strengths: saved.strengths,
            gaps: saved.gaps,
            rubricAlignment: saved.rubricAlignment,
            status: saved.status,
            createdAt: saved.createdAt.toISOString(),
          })
        }
      } else {
        // Regular single-part FRQ
        const maxPoints = Number(answer.question.points)
        const aiSuggestion = await requestFrqSuggestion({
          questionPrompt: answer.question.promptMd,
          rubric: answer.question.explanation,
          maxPoints,
          studentResponse: answer.answerText,
        })

        const saved = await prisma.aiGradingSuggestion.create({
          data: {
            testId: resolvedParams.testId,
            attemptId: resolvedParams.attemptId,
            answerId: answer.id,
            questionId: answer.questionId,
            requestedByUserId: session.user.id,
            requestedByMembershipId: adminMembership?.id,
            suggestedPoints: new Prisma.Decimal(aiSuggestion.suggestedScore),
            maxPoints: new Prisma.Decimal(aiSuggestion.maxScore || maxPoints),
            explanation: aiSuggestion.summary,
            strengths: aiSuggestion.strengths,
            gaps: aiSuggestion.gaps,
            rubricAlignment: aiSuggestion.rubricAlignment,
            rawResponse: aiSuggestion.rawResponse,
          },
        })

        suggestions.push({
          id: saved.id,
          answerId: saved.answerId,
          questionId: saved.questionId,
          suggestedPoints: Number(saved.suggestedPoints),
          maxPoints: Number(saved.maxPoints),
          explanation: saved.explanation,
          strengths: saved.strengths,
          gaps: saved.gaps,
          rubricAlignment: saved.rubricAlignment,
          status: saved.status,
          createdAt: saved.createdAt.toISOString(),
        })
      }
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('AI grading error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message?.includes('OpenAI')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to request AI suggestion' },
      { status: 500 }
    )
  }
}

