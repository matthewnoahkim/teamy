import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getBirthYearBounds,
  isUnder13ForBirthDate,
  parseBirthMonthYear,
  withAgeVerification,
} from '@/lib/age-verification'

const { minBirthYear, maxBirthYear } = getBirthYearBounds()

const ageVerificationSchema = z.object({
  birthMonth: z.coerce.number().int().min(1).max(12),
  birthYear: z.coerce.number().int().min(minBirthYear).max(maxBirthYear),
  parentConsent: z.boolean().optional().default(false),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsedBody = ageVerificationSchema.safeParse(body)
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Please provide a valid birth month and birth year.' },
        { status: 400 }
      )
    }

    const parsedBirthDate = parseBirthMonthYear(parsedBody.data.birthMonth, parsedBody.data.birthYear)
    if (!parsedBirthDate) {
      return NextResponse.json(
        { error: 'Please provide a valid birth month and birth year.' },
        { status: 400 }
      )
    }

    const isUnder13 = isUnder13ForBirthDate(parsedBirthDate.birthMonth, parsedBirthDate.birthYear)
    const parentConsent = parsedBody.data.parentConsent === true

    if (isUnder13 && !parentConsent) {
      return NextResponse.json(
        { error: 'Parent or guardian consent is required for users under 13.' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })

    const updatedPreferences = withAgeVerification(existingUser?.preferences, {
      birthMonth: parsedBirthDate.birthMonth,
      birthYear: parsedBirthDate.birthYear,
      parentConsent,
    })

    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: updatedPreferences as Prisma.InputJsonValue },
      select: { id: true },
    })

    return NextResponse.json({
      success: true,
      isUnder13,
    })
  } catch (error) {
    console.error('Error saving age verification:', error)
    return NextResponse.json({ error: 'Failed to save age verification' }, { status: 500 })
  }
}
