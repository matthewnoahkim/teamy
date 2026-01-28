import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'
import { isWithinMeetingWindow, generateAttendanceCode, hashAttendanceCode } from '@/lib/attendance'

// POST /api/attendance/[attendanceId]/code/regenerate
// Regenerate the attendance code (admins only, during meeting window)
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

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        calendarEvent: true,
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // Only admins can regenerate codes
    await requireAdmin(session.user.id, attendance.clubId)

    // Admins can generate codes anytime (not just during meeting window)
    // This allows pre-meeting preparation

    // Generate new code
    const newCode = generateAttendanceCode()
    const newCodeHash = await hashAttendanceCode(newCode)

    // Update attendance with new code hash
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { codeHash: newCodeHash },
    })

    // Return the plaintext code (only time it's ever sent to client)
    return NextResponse.json({ 
      code: newCode,
      message: 'Code regenerated successfully. Share this code with attendees.',
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Regenerate code error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

