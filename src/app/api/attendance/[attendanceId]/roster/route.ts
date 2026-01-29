import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/rbac'

// GET /api/attendance/[attendanceId]/roster
// Get full attendance roster (admins only)
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

    // Only admins can view full roster
    await requireAdmin(session.user.id, attendance.clubId)

    // Get all check-ins with user details
    const checkIns = await prisma.attendanceCheckIn.findMany({
      where: { attendanceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        membership: {
          include: {
            team: true,
          },
        },
      },
      orderBy: {
        checkedInAt: 'asc',
      },
    })

    // Get all team members for comparison
    const allMembers = await prisma.membership.findMany({
      where: { teamId: attendance.clubId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: true,
      },
    })

    // Calculate who's missing
    const checkedInUserIds = new Set(checkIns.map((ci) => ci.userId))
    const missingMembers = allMembers.filter((m) => !checkedInUserIds.has(m.userId))

    return NextResponse.json({
      checkIns,
      totalMembers: allMembers.length,
      checkedInCount: checkIns.length,
      missingMembers,
      attendance,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get roster error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

