export interface TDPortalNotificationItem {
  id?: string
  createdAt: string | Date
  updatedAt?: string | Date
}

export function isTDPortalRequestNotification(notification: TDPortalNotificationItem): boolean {
  return !notification.id?.startsWith('staff-')
}

function parseNotificationTime(value: string | Date | null | undefined): number | null {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function getTDPortalNotificationTimestamp(notification: TDPortalNotificationItem): number {
  return (
    parseNotificationTime(notification.updatedAt) ??
    parseNotificationTime(notification.createdAt) ??
    0
  )
}

export function getLatestTDPortalNotificationSeenAt(
  notifications: TDPortalNotificationItem[],
): string | null {
  const latestTimestamp = notifications.reduce((latest, notification) => {
    const timestamp = getTDPortalNotificationTimestamp(notification)
    return timestamp > latest ? timestamp : latest
  }, 0)

  return latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null
}

export function isTDPortalNotificationUnread(
  notification: TDPortalNotificationItem,
  seenAt: string | null,
): boolean {
  const seenTimestamp = parseNotificationTime(seenAt)
  if (seenTimestamp === null) {
    return false
  }

  return getTDPortalNotificationTimestamp(notification) > seenTimestamp
}

export function getTDPortalUnreadCount(
  notifications: TDPortalNotificationItem[],
  seenAt: string | null,
): number {
  return notifications.reduce((count, notification) => {
    return count + (isTDPortalNotificationUnread(notification, seenAt) ? 1 : 0)
  }, 0)
}
