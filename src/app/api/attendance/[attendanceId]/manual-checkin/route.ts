import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin, getUserMembership } from '@/lib/rbac'
import { z } from 'zod'
import { CheckInSource } from '@prisma/client'

const manualCheckInSchema = z.object({
  userId: z.string(),
})

// POST /api/attendance/[attendanceId]/manual-checkin
// Manually add a check-in (admins only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ attendanceId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { attendanceId } = resolvedParams
    const body = await req.json()
    const validated = manualCheckInSchema.parse(body)

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        calendarEvent: true,
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // Only admins can manually add check-ins
    await requireAdmin(session.user.id, attendance.clubId)

    // Verify the user being checked in is a member of the team
    const targetMembership = await getUserMembership(validated.userId, attendance.clubId)
    if (!targetMembership) {
      return NextResponse.json({ error: 'User is not a member of this team' }, { status: 404 })
    }

    // Check if already checked in
    const existingCheckIn = await prisma.attendanceCheckIn.findUnique({
      where: {
        attendanceId_userId: {
          attendanceId,
          userId: validated.userId,
        },
      },
    })

    if (existingCheckIn) {
      return NextResponse.json(
        { error: 'User is already checked in' },
        { status: 400 }
      )
    }

    // Create manual check-in
    const checkIn = await prisma.attendanceCheckIn.create({
      data: {
        attendanceId,
        userId: validated.userId,
        membershipId: targetMembership.id,
        source: CheckInSource.MANUAL,
        reason: null,
        checkedInAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({
      message: 'Manual check-in added successfully',
      checkIn,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Manual check-in error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

