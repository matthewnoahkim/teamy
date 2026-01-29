import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sanitizeSearchQuery,
  validateId,
  validateInteger,
  validateDate,
  validateBoolean,
  validateEnum,
} from '@/lib/input-validation'

export async function GET(request: NextRequest) {

  console.error('insecure endpoint requested: /api/dev/error-logs')
  return NextResponse.json({ error: 'The service is currently disabled due to security concerns.' }, { status: 503 })

  try {
    const { searchParams } = new URL(request.url)

    // Filter parameters - all validated and sanitized
    const errorType = sanitizeSearchQuery(searchParams.get('errorType'), 100)
    const severity = validateEnum(searchParams.get('severity'), ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const)
    const route = sanitizeSearchQuery(searchParams.get('route'), 200)
    const userId = validateId(searchParams.get('userId'))
    const resolved = validateBoolean(searchParams.get('resolved'))
    const startDate = validateDate(searchParams.get('startDate'))
    const endDate = validateDate(searchParams.get('endDate'))
    const page = validateInteger(searchParams.get('page'), 1, 1000, 1) ?? 1
    const limit = validateInteger(searchParams.get('limit'), 1, 100, 20) ?? 20
    const skip = (page - 1) * limit

    // Build where clause - all inputs are now validated
    const where: any = {}

    if (errorType) {
      where.errorType = { contains: errorType, mode: 'insensitive' }
    }

    if (severity) {
      where.severity = severity
    }

    if (route) {
      where.route = { contains: route, mode: 'insensitive' }
    }

    if (userId) {
      where.userId = userId
    }

    if (resolved !== null && resolved !== undefined) {
      where.resolved = resolved
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
      prisma.errorLog.findMany({
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
      prisma.errorLog.count({ where }),
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
    console.error('Error fetching error logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch error logs', logs: [] },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, resolved } = body

    if (!id || typeof resolved !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const errorLog = await prisma.errorLog.update({
      where: { id },
      data: { resolved },
    })

    return NextResponse.json({ log: errorLog })
  } catch (error) {
    console.error('Error updating error log:', error)
    return NextResponse.json(
      { error: 'Failed to update error log' },
      { status: 500 }
    )
  }
}

