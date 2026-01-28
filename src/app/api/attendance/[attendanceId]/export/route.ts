import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'
import { generateAttendanceCSV } from '@/lib/attendance'

// GET /api/attendance/[attendanceId]/export
// Export attendance as CSV (admins only)
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
        checkIns: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            checkedInAt: 'asc',
          },
        },
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // Only admins can export
    await requireAdmin(session.user.id, attendance.clubId)

    // Generate CSV
    const csv = generateAttendanceCSV({
      event: {
        title: attendance.calendarEvent.title,
      },
      checkIns: attendance.checkIns.map((ci) => ({
        user: ci.user,
        checkedInAt: ci.checkedInAt,
      })),
    })

    // Return CSV with appropriate headers
    const cleanTitle = attendance.calendarEvent.title.replace(/[^a-z0-9\s]/gi, '').trim().replace(/\s+/g, ' ')
    const filename = `${cleanTitle} attendance.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Export attendance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

