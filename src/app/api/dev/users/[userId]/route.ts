import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDevAccess } from '@/lib/dev/guard'
import { deleteUserAccountData } from '@/lib/user-account-deletion'

// WARNING: This endpoint allows deleting users. Protected by requireDevAccess (session whitelist or INTERNAL_API_KEY).

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const guard = await requireDevAccess(request, '/api/dev/users/[userId]')
  if (!guard.allowed) return guard.response

  const resolvedParams = await params
  try {
    const { userId } = resolvedParams
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await deleteUserAccountData(tx, userId)
    })

    // Log the deletion
    try {
      await prisma.activityLog.create({
        data: {
          action: 'USER_DELETED',
          description: `User ${targetUser.email} (${targetUser.id}) was deleted from dev panel`,
          logType: 'ADMIN_ACTION',
          severity: 'WARNING',
          route: '/api/dev/users/[userId]',
          metadata: { userId, email: targetUser.email, name: targetUser.name },
        },
      })
    } catch (logError) {
      // Ignore if ActivityLog table doesn't exist yet or logging fails
      console.error('Failed to log user deletion:', logError)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Error deleting user:', err)
    let errorMessage = 'Unknown error'
    if (err instanceof Error) {
      errorMessage = (err as Error).message
    } else if (typeof err === 'string') {
      errorMessage = err as string
    } else if (err !== null && err !== undefined) {
      try {
        errorMessage = JSON.stringify(err)
      } catch {
        errorMessage = 'Unknown error'
      }
    }
    return NextResponse.json(
      { error: 'Failed to delete user', details: errorMessage },
      { status: 500 }
    )
  }
}
