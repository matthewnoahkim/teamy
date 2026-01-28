import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserMembership } from '@/lib/rbac'
import { Role } from '@prisma/client'
import { z } from 'zod'

// Helper to check if user is tournament admin
async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  return !!admin
}

const updateRegistrationSchema = z.object({
  paid: z.boolean().optional(),
})

// PATCH /api/tournaments/[tournamentId]/register/[registrationId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; registrationId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is tournament admin
    const userIsAdmin = await isTournamentAdmin(session.user.id, resolvedParams.tournamentId)
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Only tournament admins can update registration status' }, { status: 403 })
    }

    // Get the registration to verify it belongs to the tournament
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: resolvedParams.registrationId },
    })

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    if (registration.tournamentId !== resolvedParams.tournamentId) {
      return NextResponse.json({ error: 'Registration does not belong to this tournament' }, { status: 400 })
    }

    const body = await req.json()
    const validated = updateRegistrationSchema.parse(body)

    // Only update if paid is provided
    if (validated.paid === undefined) {
      return NextResponse.json({ error: 'paid field is required' }, { status: 400 })
    }

    // Update the registration
    const updatedRegistration = await prisma.tournamentRegistration.update({
      where: { id: resolvedParams.registrationId },
      data: {
        paid: validated.paid,
      },
    })

    return NextResponse.json({ registration: updatedRegistration })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    
    // Enhanced error logging
    console.error('Update registration error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCode = (error as any)?.code
    const errorMeta = (error as any)?.meta
    
    // Check for Prisma errors
    if (errorCode === 'P2009' || errorMessage.includes('Unknown column') || (errorMessage.includes('column') && errorMessage.includes('does not exist'))) {
      return NextResponse.json({ 
        error: 'Database schema error. The paid column may not exist. Please run: npx prisma generate',
        details: process.env.NODE_ENV === 'development' ? { errorMessage, errorCode, meta: errorMeta } : undefined 
      }, { status: 500 })
    }
    
    // Prisma validation errors
    if (errorCode === 'P2002') {
      return NextResponse.json({ 
        error: 'Validation error',
        details: process.env.NODE_ENV === 'development' ? errorMeta : undefined 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        message: errorMessage,
        code: errorCode,
        meta: errorMeta,
        stack: error instanceof Error ? error.stack : undefined
      } : undefined 
    }, { status: 500 })
  }
}

// DELETE /api/tournaments/[tournamentId]/register/[registrationId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tournamentId: string; registrationId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the registration
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: resolvedParams.registrationId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    // Verify the registration belongs to the tournament
    if (registration.tournamentId !== resolvedParams.tournamentId) {
      return NextResponse.json({ error: 'Registration does not belong to this tournament' }, { status: 400 })
    }

    // Verify user is an admin of the team
    const membership = await getUserMembership(session.user.id, registration.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'You must be a member of this team' }, { status: 403 })
    }

    if (membership.role !== Role.ADMIN) {
      return NextResponse.json({ 
        error: `You must be an admin of ${registration.club.name} to deregister from tournaments` 
      }, { status: 403 })
    }

    // Delete the registration (cascade will handle event selections)
    await prisma.tournamentRegistration.delete({
      where: { id: resolvedParams.registrationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Deregister from tournament error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 })
  }
}
