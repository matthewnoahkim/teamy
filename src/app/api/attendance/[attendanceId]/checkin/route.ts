import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership } from '@/lib/rbac'
import {
  isWithinMeetingWindow,
  verifyAttendanceCode,
  checkRateLimit,
  logCodeAttempt,
  getClientIp,
} from '@/lib/attendance'
import { z } from 'zod'
import { CheckInSource } from '@prisma/client'

const checkInSchema = z.object({
  code: z.string().min(6).max(10),
})

// POST /api/attendance/[attendanceId]/checkin
// Check in to an event with code
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
    const validated = checkInSchema.parse(body)

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        calendarEvent: true,
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // Verify user is a member of the team
    await requireMember(session.user.id, attendance.clubId)

    const membership = await getUserMembership(session.user.id, attendance.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check if event is cancelled
    if (attendance.status === 'CANCELLED') {
      return NextResponse.json({ error: 'This event has been cancelled' }, { status: 400 })
    }

    // Check if within meeting window
    const inWindow = isWithinMeetingWindow(
      attendance.calendarEvent.startUTC,
      attendance.calendarEvent.endUTC,
      attendance.graceMinutes
    )

    if (!inWindow) {
      return NextResponse.json(
        {
          error: 'Check-in is only allowed during meeting hours',
          eventStart: attendance.calendarEvent.startUTC,
          eventEnd: attendance.calendarEvent.endUTC,
          graceMinutes: attendance.graceMinutes,
        },
        { status: 403 }
      )
    }

    // Get client IP for rate limiting
    const ipAddress = getClientIp(req.headers)

    // Check rate limiting (5 attempts per 5 minutes)
    const rateLimited = await checkRateLimit(attendanceId, session.user.id, ipAddress, 5, 5)
    if (rateLimited) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in a few minutes.' },
        { status: 429 }
      )
    }

    // Verify code
    const codeValid = await verifyAttendanceCode(validated.code.toUpperCase(), attendance.codeHash)

    // Log attempt
    await logCodeAttempt(attendanceId, session.user.id, ipAddress, codeValid)

    if (!codeValid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Check if already checked in
    const existingCheckIn = await prisma.attendanceCheckIn.findUnique({
      where: {
        attendanceId_userId: {
          attendanceId,
          userId: session.user.id,
        },
      },
    })

    if (existingCheckIn) {
      return NextResponse.json(
        {
          message: 'You are already checked in',
          checkIn: existingCheckIn,
        },
        { status: 200 }
      )
    }

    // Create check-in
    const checkIn = await prisma.attendanceCheckIn.create({
      data: {
        attendanceId,
        userId: session.user.id,
        membershipId: membership.id,
        source: CheckInSource.CODE,
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
      message: 'Successfully checked in!',
      checkIn,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid code format', details: error.issues }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Check-in error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

