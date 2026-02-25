import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sanitizeSearchQuery,
  validateInteger,
  validateEnum,
} from '@/lib/input-validation'
import { requireDevAccess } from '@/lib/dev/guard'

// GET - List audit logs
export async function GET(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/audit-logs')
  if (!guard.allowed) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    
    // Validate and sanitize all inputs
    const limit = validateInteger(searchParams.get('limit'), 1, 1000, 100) ?? 100
    const offset = validateInteger(searchParams.get('offset'), 0, 100000, 0) ?? 0
    const action = validateEnum(searchParams.get('action'), ['CREATE', 'UPDATE', 'DELETE', 'READ'] as const)
    const userEmail = sanitizeSearchQuery(searchParams.get('userEmail'), 200)

    const where: Record<string, unknown> = {}
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

