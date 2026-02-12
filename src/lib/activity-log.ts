import { prisma } from './prisma'

export async function logActivity(data: {
  action: string
  description: string
  userId?: string
  logType?: 'USER_ACTION' | 'ADMIN_ACTION' | 'SYSTEM_EVENT' | 'API_USAGE' | 'ERROR' | 'WARNING'
  severity?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  route?: string
  metadata?: Record<string, unknown>
}) {
  try {
    await prisma.activityLog.create({
      data: {
        action: data.action,
        description: data.description,
        userId: data.userId,
        logType: data.logType || 'SYSTEM_EVENT',
        severity: data.severity || 'INFO',
        route: data.route,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
      },
    })
  } catch (error) {
    // Fail silently - logging shouldn't break the app
    console.error('Failed to log activity:', error)
  }
}

