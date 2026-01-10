import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  sanitizeSearchQuery,
  validateId,
  validateInteger,
  validateDate,
  validateEnum,
} from '@/lib/input-validation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Filter parameters - all validated and sanitized
    const logType = validateEnum(searchParams.get('logType'), ['ACTIVITY', 'API', 'ERROR'] as const)
    const severity = validateEnum(searchParams.get('severity'), ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const)
    const route = sanitizeSearchQuery(searchParams.get('route'), 200)
    const userId = validateId(searchParams.get('userId'))
    const action = sanitizeSearchQuery(searchParams.get('action'), 100)
    const startDate = validateDate(searchParams.get('startDate'))
    const endDate = validateDate(searchParams.get('endDate'))
    const page = validateInteger(searchParams.get('page'), 1, 1000, 1) ?? 1
    const limit = validateInteger(searchParams.get('limit'), 1, 100, 20) ?? 20
    const skip = (page - 1) * limit

    // Build where clause - all inputs are now validated
    const where: any = {}
    
    if (logType) {
      where.logType = logType
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
    
    if (action) {
      where.action = { contains: action, mode: 'insensitive' }
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
      prisma.activityLog.findMany({
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
      prisma.activityLog.count({ where }),
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
    console.error('Error fetching logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch logs', logs: [] },
      { status: 500 }
    )
  }
}
