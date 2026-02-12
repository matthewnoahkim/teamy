import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

interface AuditLogParams {
  userId: string
  userEmail: string
  userName?: string | null
  action: string
  target?: string
  details?: Record<string, unknown>
  request?: NextRequest
}

export async function createAuditLog({
  userId,
  userEmail,
  userName,
  action,
  target,
  details,
  request,
}: AuditLogParams) {
  try {
    // Extract IP and user agent if request is provided
    let ipAddress: string | null = null
    let userAgent: string | null = null

    if (request) {
      ipAddress = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  null
      userAgent = request.headers.get('user-agent') || null
    }

    await prisma.devAuditLog.create({
      data: {
        userId,
        userEmail,
        userName: userName || null,
        action,
        target: target || null,
        details: details as Prisma.InputJsonValue | undefined,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - we don't want audit logging to break the actual operation
  }
}

