import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  sanitizeSearchQuery,
  validateInteger,
  validateEnum,
} from '@/lib/input-validation'

// Helper function to check dev panel access
async function checkDevAccess(email?: string | null) {
  if (!email) return false

  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'dev_panel_email_whitelist' },
  })

  if (setting) {
    try {
      const emails = JSON.parse(setting.value)
      if (Array.isArray(emails) && emails.map((e: string) => e.toLowerCase()).includes(email.toLowerCase())) {
        return true
      }
    } catch (e) {
      console.error('Failed to parse email whitelist:', e)
    }
  }

  const defaultEmails = process.env.DEV_PANEL_DEFAULT_EMAILS
  if (defaultEmails) {
    const emailList = defaultEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
    return emailList.includes(email.toLowerCase())
  }

  return false
}

// GET - List audit logs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await checkDevAccess(session.user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    
    // Validate and sanitize all inputs
    const limit = validateInteger(searchParams.get('limit'), 1, 1000, 100) ?? 100
    const offset = validateInteger(searchParams.get('offset'), 0, 100000, 0) ?? 0
    const action = validateEnum(searchParams.get('action'), ['CREATE', 'UPDATE', 'DELETE', 'READ'] as const)
    const userEmail = sanitizeSearchQuery(searchParams.get('userEmail'), 200)

    const where: any = {}
    if (action) where.action = action
    if (userEmail) where.userEmail = { contains: userEmail, mode: 'insensitive' }

    const [logs, total] = await Promise.all([
      prisma.devAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.devAuditLog.count({ where }),
    ])

    return NextResponse.json({ logs, total })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

