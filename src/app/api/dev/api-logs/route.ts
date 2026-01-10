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
  try {
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
    const where: any = {}
    
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

