import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasESAccess } from '@/lib/rbac'
import { z } from 'zod'
import { CalculatorType, ScoreReleaseMode } from '@prisma/client'

const updateDefaultTestSettingsSchema = z.object({
  defaultDurationMinutes: z.number().int().positive().nullable().optional(),
  defaultStartAt: z.string().datetime().nullable().optional().or(z.literal('').transform(() => null)),
  defaultEndAt: z.string().datetime().nullable().optional().or(z.literal('').transform(() => null)),
  defaultReleaseScoresAt: z.string().datetime().nullable().optional().or(z.literal('').transform(() => null)),
  defaultScoreReleaseMode: z.enum(['NONE', 'SCORE_ONLY', 'SCORE_WITH_WRONG', 'FULL_TEST']).nullable().optional().or(z.literal('').transform(() => null)),
  defaultRequireFullscreen: z.boolean().nullable().optional(),
  defaultAllowCalculator: z.boolean().nullable().optional(),
  defaultCalculatorType: z.enum(['FOUR_FUNCTION', 'SCIENTIFIC', 'GRAPHING']).nullable().optional().or(z.literal('').transform(() => null)),
  defaultAllowNoteSheet: z.boolean().nullable().optional(),
  defaultAutoApproveNoteSheet: z.boolean().nullable().optional(),
  defaultRequireOneSitting: z.boolean().nullable().optional(),
  defaultMaxAttempts: z.number().int().positive().nullable().optional(),
})

// GET /api/td/tournaments/[tournamentId]/default-test-settings
// Get default test settings for a tournament
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> | { tournamentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const tournamentId = resolvedParams.tournamentId

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 })
    }

    // Check if user has access to this tournament
    const hasAccess = await hasESAccess(session.user.id, session.user.email, tournamentId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get tournament with default test settings
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        defaultDurationMinutes: true,
        defaultStartAt: true,
        defaultEndAt: true,
        defaultReleaseScoresAt: true,
        defaultScoreReleaseMode: true,
        defaultRequireFullscreen: true,
        defaultAllowCalculator: true,
        defaultCalculatorType: true,
        defaultAllowNoteSheet: true,
        defaultAutoApproveNoteSheet: true,
        defaultRequireOneSitting: true,
        defaultMaxAttempts: true,
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    return NextResponse.json({
      defaultTestSettings: {
        defaultDurationMinutes: tournament.defaultDurationMinutes,
        defaultStartAt: tournament.defaultStartAt?.toISOString() || null,
        defaultEndAt: tournament.defaultEndAt?.toISOString() || null,
        defaultReleaseScoresAt: tournament.defaultReleaseScoresAt?.toISOString() || null,
        defaultScoreReleaseMode: tournament.defaultScoreReleaseMode,
        defaultRequireFullscreen: tournament.defaultRequireFullscreen,
        defaultAllowCalculator: tournament.defaultAllowCalculator,
        defaultCalculatorType: tournament.defaultCalculatorType,
        defaultAllowNoteSheet: tournament.defaultAllowNoteSheet,
        defaultAutoApproveNoteSheet: tournament.defaultAutoApproveNoteSheet,
        defaultRequireOneSitting: tournament.defaultRequireOneSitting,
        defaultMaxAttempts: tournament.defaultMaxAttempts,
      },
    })
  } catch (error) {
    console.error('Error fetching default test settings:', error)
    return NextResponse.json({ error: 'Failed to fetch default test settings' }, { status: 500 })
  }
}

// PATCH /api/td/tournaments/[tournamentId]/default-test-settings
// Update default test settings for a tournament
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> | { tournamentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const tournamentId = resolvedParams.tournamentId

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 })
    }

    // Check if user has access to this tournament
    const hasAccess = await hasESAccess(session.user.id, session.user.email, tournamentId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await req.json()
    
    // Pre-process body to convert empty strings to null
    const processedBody = Object.fromEntries(
      Object.entries(body).map(([key, value]) => {
        if (value === '' || value === undefined) {
          return [key, null]
        }
        return [key, value]
      })
    )
    
    const validated = updateDefaultTestSettingsSchema.parse(processedBody)

    // Build update data
    const updateData: any = {}
    if (validated.defaultDurationMinutes !== undefined) {
      updateData.defaultDurationMinutes = validated.defaultDurationMinutes
    }
    if (validated.defaultStartAt !== undefined) {
      updateData.defaultStartAt = validated.defaultStartAt
        ? new Date(validated.defaultStartAt)
        : null
    }
    if (validated.defaultEndAt !== undefined) {
      updateData.defaultEndAt = validated.defaultEndAt
        ? new Date(validated.defaultEndAt)
        : null
    }
    if (validated.defaultReleaseScoresAt !== undefined) {
      updateData.defaultReleaseScoresAt = validated.defaultReleaseScoresAt
        ? new Date(validated.defaultReleaseScoresAt)
        : null
    }
    if (validated.defaultScoreReleaseMode !== undefined) {
      updateData.defaultScoreReleaseMode = validated.defaultScoreReleaseMode as ScoreReleaseMode | null
    }
    if (validated.defaultRequireFullscreen !== undefined) {
      updateData.defaultRequireFullscreen = validated.defaultRequireFullscreen
    }
    if (validated.defaultAllowCalculator !== undefined) {
      updateData.defaultAllowCalculator = validated.defaultAllowCalculator
    }
    if (validated.defaultCalculatorType !== undefined) {
      updateData.defaultCalculatorType = validated.defaultCalculatorType as CalculatorType | null
    }
    if (validated.defaultAllowNoteSheet !== undefined) {
      updateData.defaultAllowNoteSheet = validated.defaultAllowNoteSheet
    }
    if (validated.defaultAutoApproveNoteSheet !== undefined) {
      updateData.defaultAutoApproveNoteSheet = validated.defaultAutoApproveNoteSheet
    }
    if (validated.defaultRequireOneSitting !== undefined) {
      updateData.defaultRequireOneSitting = validated.defaultRequireOneSitting
    }
    if (validated.defaultMaxAttempts !== undefined) {
      updateData.defaultMaxAttempts = validated.defaultMaxAttempts
    }

    // Update tournament
    const updatedTournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: updateData,
      select: {
        defaultDurationMinutes: true,
        defaultStartAt: true,
        defaultEndAt: true,
        defaultReleaseScoresAt: true,
        defaultScoreReleaseMode: true,
        defaultRequireFullscreen: true,
        defaultAllowCalculator: true,
        defaultCalculatorType: true,
        defaultAllowNoteSheet: true,
        defaultAutoApproveNoteSheet: true,
        defaultRequireOneSitting: true,
        defaultMaxAttempts: true,
      },
    })

    return NextResponse.json({
      defaultTestSettings: {
        defaultDurationMinutes: updatedTournament.defaultDurationMinutes,
        defaultStartAt: updatedTournament.defaultStartAt?.toISOString() || null,
        defaultEndAt: updatedTournament.defaultEndAt?.toISOString() || null,
        defaultReleaseScoresAt: updatedTournament.defaultReleaseScoresAt?.toISOString() || null,
        defaultScoreReleaseMode: updatedTournament.defaultScoreReleaseMode,
        defaultRequireFullscreen: updatedTournament.defaultRequireFullscreen,
        defaultAllowCalculator: updatedTournament.defaultAllowCalculator,
        defaultCalculatorType: updatedTournament.defaultCalculatorType,
        defaultAllowNoteSheet: updatedTournament.defaultAllowNoteSheet,
        defaultAutoApproveNoteSheet: updatedTournament.defaultAutoApproveNoteSheet,
        defaultRequireOneSitting: updatedTournament.defaultRequireOneSitting,
        defaultMaxAttempts: updatedTournament.defaultMaxAttempts,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Error updating default test settings:', error)
    return NextResponse.json({ error: 'Failed to update default test settings' }, { status: 500 })
  }
}

