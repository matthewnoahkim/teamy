import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serverSession } from '@/lib/server-session'
import { isTournamentDirector } from '@/lib/rbac'
import { z } from 'zod'

const settingsSchema = z.object({
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  price: z.number().min(0).optional(),
  additionalTeamPrice: z.number().min(0).nullable().optional(),
  feeStructure: z.enum(['flat', 'tiered']).optional(),
  registrationStartDate: z.string().nullable().optional(),
  registrationEndDate: z.string().nullable().optional(),
  earlyBirdDiscount: z.number().min(0).nullable().optional(),
  earlyBirdDeadline: z.string().nullable().optional(),
  lateFee: z.number().min(0).nullable().optional(),
  lateFeeStartDate: z.string().nullable().optional(),
  otherDiscounts: z.string().nullable().optional(),
  eligibilityRequirements: z.string().nullable().optional(),
  eventsRun: z.string().nullable().optional(),
  trialEvents: z.string().nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tournamentId = resolvedParams.tournamentId

    const hasDirectorAccess = await isTournamentDirector(
      session.user.id,
      session.user.email || '',
      tournamentId,
    )

    if (!hasDirectorAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = settingsSchema.parse(body)

    // Build update object
    const updateData: Record<string, unknown> = {}
    
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null
    }
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null
    }
    if (validatedData.startTime !== undefined) {
      updateData.startTime = validatedData.startTime ? new Date(validatedData.startTime) : null
    }
    if (validatedData.endTime !== undefined) {
      updateData.endTime = validatedData.endTime ? new Date(validatedData.endTime) : null
    }
    if (validatedData.price !== undefined) {
      updateData.price = validatedData.price
    }
    if (validatedData.additionalTeamPrice !== undefined) {
      updateData.additionalTeamPrice = validatedData.additionalTeamPrice
    }
    if (validatedData.feeStructure !== undefined) {
      updateData.feeStructure = validatedData.feeStructure
    }
    if (validatedData.registrationStartDate !== undefined) {
      updateData.registrationStartDate = validatedData.registrationStartDate ? new Date(validatedData.registrationStartDate) : null
    }
    if (validatedData.registrationEndDate !== undefined) {
      updateData.registrationEndDate = validatedData.registrationEndDate ? new Date(validatedData.registrationEndDate) : null
    }
    if (validatedData.earlyBirdDiscount !== undefined) {
      updateData.earlyBirdDiscount = validatedData.earlyBirdDiscount
    }
    if (validatedData.earlyBirdDeadline !== undefined) {
      updateData.earlyBirdDeadline = validatedData.earlyBirdDeadline ? new Date(validatedData.earlyBirdDeadline) : null
    }
    if (validatedData.lateFee !== undefined) {
      updateData.lateFee = validatedData.lateFee
    }
    if (validatedData.lateFeeStartDate !== undefined) {
      updateData.lateFeeStartDate = validatedData.lateFeeStartDate ? new Date(validatedData.lateFeeStartDate) : null
    }
    if (validatedData.otherDiscounts !== undefined) {
      updateData.otherDiscounts = validatedData.otherDiscounts
    }
    if (validatedData.eligibilityRequirements !== undefined) {
      updateData.eligibilityRequirements = validatedData.eligibilityRequirements
    }
    if (validatedData.eventsRun !== undefined) {
      updateData.eventsRun = validatedData.eventsRun
    }
    if (validatedData.trialEvents !== undefined) {
      // Ensure trialEvents is always a string (even if empty array, send "[]")
      // Only set to null if the value is explicitly null or empty string, not if it's "[]"
      updateData.trialEvents = validatedData.trialEvents === null || validatedData.trialEvents === '' ? null : validatedData.trialEvents
    }

    const updatedTournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: updateData,
    })

    return NextResponse.json({ success: true, tournament: updatedTournament })
  } catch (error) {
    console.error('Failed to update tournament settings:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
