import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  sanitizeSearchQuery,
  validateId,
  validateInteger,
  validateDate,
  validateBoolean,
  validateEnum,
} from '@/lib/input-validation'

async function checkDevAccess(email: string): Promise<boolean> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'dev_panel_email_whitelist' },
  })
  let whitelist: string[] = []
  if (setting) {
    try {
      whitelist = JSON.parse(setting.value)
      if (!Array.isArray(whitelist)) whitelist = []
    } catch { whitelist = [] }
  }
  if (whitelist.length === 0) {
    const defaultEmailsEnv = process.env.DEV_PANEL_DEFAULT_EMAILS
    if (defaultEmailsEnv) {
      whitelist = defaultEmailsEnv.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0 && e.includes('@'))
    }
  }
  return whitelist.some(e => e.toLowerCase().trim() === email.toLowerCase().trim())
}

export async function GET(request: NextRequest) {
  try {
    // Auth check: require authenticated user with dev panel access
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const hasAccess = await checkDevAccess(session.user.email)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    
    // Filter parameters - all validated and sanitized
    const method = validateEnum(searchParams.get('method'), ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const)
    const route = sanitizeSearchQuery(searchParams.get('route'), 200)
    const statusCode = validateInteger(searchParams.get('statusCode'), 100, 599)
    const userId = validateId(searchParams.get('userId'))
    const minExecutionTime = validateInteger(searchParams.get('minExecutionTime'), 0, 60000) // Max 60 seconds
    const errorsOnly = validateBoolean(searchParams.get('errorsOnly')) ?? false
    const slowOnly = validateBoolean(searchParams.get('slowOnly')) ?? false
    const startDate = validateDate(searchParams.get('startDate'))
    const endDate = validateDate(searchParams.get('endDate'))
    const page = validateInteger(searchParams.get('page'), 1, 1000, 1) ?? 1
    const limit = validateInteger(searchParams.get('limit'), 1, 100, 20) ?? 20
    const skip = (page - 1) * limit

    // Build where clause - all inputs are now validated
    const where: Record<string, unknown> = {}
    
    if (method) {
      where.method = method
    }
    
    if (route) {
      where.route = { contains: route, mode: 'insensitive' }
    }
    
    if (statusCode !== null) {
      where.statusCode = statusCode
    }
    
    if (userId) {
      where.userId = userId
    }
    
    if (errorsOnly) {
      where.statusCode = { gte: 400 }
    }
    
    if (slowOnly) {
      where.executionTime = { gte: 1000 } // 1 second or more
    }
    
    if (minExecutionTime !== null) {
      where.executionTime = { gte: minExecutionTime }
    }
    
    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) {
        where.timestamp.gte = startDate
      }
      if (endDate) {
        where.timestamp.lte = endDate
      }
    }

    const [logs, total] = await Promise.all([
      prisma.apiLog.findMany({
        where,
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
          timestamp: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.apiLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching API logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API logs', logs: [] },
      { status: 500 }
    )
  }
}

