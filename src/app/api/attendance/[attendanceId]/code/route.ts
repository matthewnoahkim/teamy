import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'
import { isWithinMeetingWindow, generateAttendanceCode, hashAttendanceCode } from '@/lib/attendance'

// GET /api/attendance/[attendanceId]/code
// Reveal the attendance code (admins only, during meeting window)
export async function GET(
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

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        calendarEvent: true,
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // Only admins can reveal codes
    await requireAdmin(session.user.id, attendance.clubId)

    // Check if within meeting window
    const inWindow = isWithinMeetingWindow(
      attendance.calendarEvent.startUTC,
      attendance.calendarEvent.endUTC,
      attendance.graceMinutes
    )

    if (!inWindow) {
      return NextResponse.json(
        { 
          error: 'Code can only be revealed during meeting hours',
          canReveal: false,
          eventStart: attendance.calendarEvent.startUTC,
          eventEnd: attendance.calendarEvent.endUTC,
          graceMinutes: attendance.graceMinutes,
        },
        { status: 403 }
      )
    }

    // Since we store only hashes, we need to generate a new code
    // This endpoint should typically be used after regenerating
    // For now, return that code needs to be regenerated
    return NextResponse.json({
      message: 'Use POST /regenerate to generate a new code',
      canReveal: true,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Reveal code error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

