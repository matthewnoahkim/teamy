import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership, isAdmin } from '@/lib/rbac'
import { getOpenAIClient } from '@/lib/ai'
import { z } from 'zod'

const generateRosterSchema = z.object({
  clubId: z.string(),
  teamId: z.string().optional(),
  additionalInstructions: z.string().optional(),
})

// POST /api/ai/roster - Generate AI roster suggestions
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = generateRosterSchema.parse(body)

    await requireMember(session.user.id, validated.clubId)

    // Only admins can generate rosters
    const isAdminUser = await isAdmin(session.user.id, validated.clubId)
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Only admins can generate rosters' }, { status: 403 })
    }

    const membership = await getUserMembership(session.user.id, validated.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Get OpenAI client
    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json({ error: 'AI features are not configured' }, { status: 503 })
    }

    // Get club info
    const club = await prisma.club.findUnique({
      where: { id: validated.clubId },
      select: { id: true, name: true, division: true },
    })

    if (!club) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Build where clause for memberships
    const membershipWhere: Record<string, unknown> = { clubId: validated.clubId }
    if (validated.teamId) {
      membershipWhere.teamId = validated.teamId
    }

    // Get all relevant data for roster generation
    const memberships = await prisma.membership.findMany({
      where: membershipWhere,
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
        preferences: true,
        rosterAssignments: {
          include: {
            event: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    })

    // Get test scores
    const testAttempts = await prisma.testAttempt.findMany({
      where: {
        test: { clubId: validated.clubId },
        status: { in: ['SUBMITTED', 'GRADED'] },
        membershipId: { in: memberships.map(m => m.id) },
      },
      include: {
        test: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Get attendance stats
    const attendanceCounts = await prisma.attendanceCheckIn.groupBy({
      by: ['membershipId'],
      where: {
        membershipId: { in: memberships.map(m => m.id) },
      },
      _count: {
        id: true,
      },
    })

    // Get todo completion stats
    const todoStats = await prisma.todo.groupBy({
      by: ['membershipId', 'completed'],
      where: {
        membershipId: { in: memberships.map(m => m.id) },
      },
      _count: {
        id: true,
      },
    })

    // Get events for division
    const events = await prisma.event.findMany({
      where: { division: club.division },
      select: {
        id: true,
        name: true,
        slug: true,
        maxCompetitors: true,
      },
      orderBy: { name: 'asc' },
    })

    // Build member profiles for AI
    const memberProfiles = memberships.map(m => {
      // Get test scores
      const memberAttempts = testAttempts.filter(a => a.membershipId === m.id)
      const avgScore = memberAttempts.length > 0
        ? memberAttempts.reduce((sum, a) => sum + (Number(a.gradeEarned) || 0), 0) / memberAttempts.length
        : null

      // Get attendance
      const attendance = attendanceCounts.find(a => a.membershipId === m.id)?._count.id || 0

      // Get todo completion
      const memberTodoStats = todoStats.filter(t => t.membershipId === m.id)
      const completedTodos = memberTodoStats.find(t => t.completed)?._count.id || 0
      const totalTodos = memberTodoStats.reduce((sum, t) => sum + t._count.id, 0)

      return {
        membershipId: m.id,
        name: m.user.name || m.user.email,
        role: m.role,
        team: m.team?.name || null,
        preferredEvents: m.preferences?.preferredEvents || [],
        avoidEvents: m.preferences?.avoidEvents || [],
        experienceLevel: m.preferences?.experienceLevel || 'INTERMEDIATE',
        strengths: m.preferences?.strengths || null,
        weaknesses: m.preferences?.weaknesses || null,
        adminNotes: m.preferences?.adminNotes || null,
        currentAssignments: m.rosterAssignments.map(a => a.event.slug),
        stats: {
          avgTestScore: avgScore ? `${avgScore.toFixed(1)}%` : 'No tests taken',
          attendanceCount: attendance,
          todoCompletion: totalTodos > 0 ? `${completedTodos}/${totalTodos}` : 'No todos',
        },
      }
    })

    // Build the AI prompt
    const prompt = `You are an expert Science Olympiad coach helping to create optimal team rosters for Division ${club.division}.

## Team Information
- Club Name: ${club.name}
- Division: ${club.division}
- ${validated.teamId ? 'Creating roster for a specific team' : 'Creating roster for the entire team'}

## Available Events (${events.length} total)
${events.map(e => `- ${e.name} (${e.slug}): max ${e.maxCompetitors} competitors`).join('\n')}

## Team Members (${memberProfiles.length} total)
${memberProfiles.map(m => `
### ${m.name}
- Role: ${m.role}
- Team: ${m.team || 'None'}
- Experience Level: ${m.experienceLevel}
- Preferred Events: ${m.preferredEvents.length > 0 ? m.preferredEvents.join(', ') : 'None specified'}
- Events to Avoid: ${m.avoidEvents.length > 0 ? m.avoidEvents.join(', ') : 'None specified'}
- Current Assignments: ${m.currentAssignments.length > 0 ? m.currentAssignments.join(', ') : 'None'}
- Test Performance: ${m.stats.avgTestScore}
- Attendance: ${m.stats.attendanceCount} sessions
- Task Completion: ${m.stats.todoCompletion}
${m.strengths ? `- Strengths: ${m.strengths}` : ''}
${m.weaknesses ? `- Weaknesses: ${m.weaknesses}` : ''}
${m.adminNotes ? `- Coach Notes: ${m.adminNotes}` : ''}
`).join('\n')}

${validated.additionalInstructions ? `## Additional Instructions from Coach\n${validated.additionalInstructions}\n` : ''}

## Task
Create an optimal roster assignment that:
1. Respects member preferences (preferred and avoided events)
2. Considers experience levels and test performance
3. Doesn't exceed max competitors per event
4. Balances workload across team members
5. Leverages member strengths and accounts for weaknesses

## Response Format
Return a JSON object with the following structure:
{
  "assignments": [
    {
      "membershipId": "string",
      "memberName": "string", 
      "events": ["event_slug_1", "event_slug_2"],
      "reasoning": "Brief explanation for this assignment"
    }
  ],
  "summary": "Overall summary of the roster strategy",
  "recommendations": ["List of additional recommendations for the coach"]
}

Return ONLY valid JSON, no additional text.`

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Science Olympiad coach assistant. You help create optimal team rosters based on member skills, preferences, and performance data. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })

    const responseText = completion.choices[0]?.message?.content || ''
    
    // Parse the AI response
    let generatedRoster
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        generatedRoster = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No valid JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      return NextResponse.json({
        error: 'Failed to parse AI response',
        rawResponse: responseText,
      }, { status: 500 })
    }

    // Store the generation in the database
    const generation = await prisma.aIRosterGeneration.create({
      data: {
        clubId: validated.clubId,
        teamId: validated.teamId,
        prompt: prompt,
        response: responseText,
        generatedRoster: generatedRoster,
        createdById: membership.id,
      },
    })

    return NextResponse.json({
      generationId: generation.id,
      roster: generatedRoster,
      memberProfiles: memberProfiles.map(m => ({
        membershipId: m.membershipId,
        name: m.name,
        currentAssignments: m.currentAssignments,
      })),
      events: events.map(e => ({
        id: e.id,
        name: e.name,
        slug: e.slug,
        maxCompetitors: e.maxCompetitors,
      })),
    })
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
    console.error('Generate roster error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/ai/roster?teamId=xxx - Get previous roster generations
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 })
    }

    await requireMember(session.user.id, teamId)

    // Only admins can view roster generations
    const isAdminUser = await isAdmin(session.user.id, teamId)
    if (!isAdminUser) {
      return NextResponse.json({ error: 'Only admins can view roster generations' }, { status: 403 })
    }

    const generations = await prisma.aIRosterGeneration.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        teamId: true,
        generatedRoster: true,
        appliedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ generations })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get roster generations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
