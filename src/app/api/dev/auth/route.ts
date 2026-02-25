import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit-log'
import { requireDevAccess } from '@/lib/dev/guard'

export async function POST(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/auth')
  if (!guard.allowed) return guard.response

  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email?.toLowerCase().trim()

    if (session?.user?.id && userEmail) {
      await createAuditLog({
        userId: session.user.id,
        userEmail,
        userName: session.user.name,
        action: 'DEV_PANEL_LOGIN',
        request,
      })
    }

    return NextResponse.json({ success: true, email: userEmail ?? null })
  } catch (error) {
    console.error('Error verifying email:', error)
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    )
  }
}

