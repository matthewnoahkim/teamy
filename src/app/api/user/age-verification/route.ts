import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { serverSession } from '@/lib/server-session'
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

export async function POST(request: Request) {
  try {
    const session = await serverSession.get()
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

    const sessionEmail = session.user.email?.trim()
    if (!existingUser && !sessionEmail) {
      return NextResponse.json(
        { error: 'Your session is out of date. Please sign in again.' },
        { status: 409 }
      )
    }

    try {
      if (!existingUser) {
        console.warn('Recovering missing authenticated user during age verification', {
          sessionUserId: session.user.id,
        })
      }

      await prisma.user.upsert({
        where: { id: session.user.id },
        update: { preferences: updatedPreferences as Prisma.InputJsonValue },
        create: {
          id: session.user.id,
          email: sessionEmail!,
          name: session.user.name ?? null,
          image: session.user.image ?? null,
          preferences: updatedPreferences as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return NextResponse.json(
          { error: 'Your session is out of date. Please sign in again.' },
          { status: 409 }
        )
      }

      throw error
    }

    return NextResponse.json({
      success: true,
      isUnder13,
    })
  } catch (error) {
    console.error('Error saving age verification:', error)
    return NextResponse.json({ error: 'Failed to save age verification' }, { status: 500 })
  }
}
