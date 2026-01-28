import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, isAdmin } from '@/lib/rbac'

// GET /api/attendance/[attendanceId]
// Get single attendance record details
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
        calendarEvent: {
          include: {
            creator: {
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
            },
            team: true,
          },
        },
        checkIns: {
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
          orderBy: {
            checkedInAt: 'asc',
          },
        },
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    await requireMember(session.user.id, attendance.clubId)

    return NextResponse.json({ attendance })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get attendance detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/attendance/[attendanceId]
// Delete attendance record only (keeps calendar event and announcement)
export async function DELETE(
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

    // Get the attendance record first to check permissions
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        calendarEvent: true,
      },
    })

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, attendance.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can delete attendance records' },
        { status: 403 }
      )
    }

    // Delete only the attendance record (calendar event and announcement remain)
    await prisma.attendance.delete({
      where: { id: attendanceId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Delete attendance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

