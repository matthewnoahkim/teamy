import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, isAdmin } from '@/lib/rbac'
import { updateAttendanceStatuses } from '@/lib/attendance'
import { logApiTiming } from '@/lib/api-timing'
import { z } from 'zod'

const _getAttendanceSchema = z.object({
  clubId: z.string(),
})

// GET /api/attendance?clubId=xxx
// List all attendance events for a club
export async function GET(req: NextRequest) {
  const startedAtMs = performance.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    await requireMember(session.user.id, clubId)

    // Update statuses before fetching
    await updateAttendanceStatuses(clubId)

    const isAdminUser = await isAdmin(session.user.id, clubId)

    // Get all attendance records for club events
    const attendances = await prisma.attendance.findMany({
      where: {
        clubId,
      },
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
        _count: {
          select: {
            checkIns: true,
          },
        },
      },
      orderBy: {
        calendarEvent: {
          startUTC: 'desc',
        },
      },
    })

    // If not an admin, only return their own check-in status
    const sanitizedAttendances = attendances.map((attendance) => {
      if (!isAdminUser) {
        // Members can only see their own check-in status
        const userCheckIn = attendance.checkIns.find((ci) => ci.user.id === session.user.id)
        return {
          ...attendance,
          checkIns: userCheckIn ? [userCheckIn] : [],
          _count: { checkIns: attendance._count.checkIns }, // Keep total count visible
        }
      }
      return attendance
    })

    logApiTiming('/api/attendance', startedAtMs, {
      clubId,
      isAdmin: isAdminUser,
      resultCount: sanitizedAttendances.length,
    })

    return NextResponse.json({ attendances: sanitizedAttendances, isAdmin: isAdminUser })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get attendance error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
