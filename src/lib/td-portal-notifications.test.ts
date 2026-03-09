import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getLatestTDPortalNotificationSeenAt,
  getTDPortalNotificationTimestamp,
  getTDPortalUnreadCount,
  isTDPortalRequestNotification,
  isTDPortalNotificationUnread,
} from '@/lib/td-portal-notifications'

test('TD portal notifications use updatedAt when present', () => {
  const timestamp = getTDPortalNotificationTimestamp({
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  })

  assert.equal(timestamp, new Date('2026-01-03T00:00:00.000Z').getTime())
})

test('TD portal notifications return latest updated timestamp for seeding seen state', () => {
  const latestSeenAt = getLatestTDPortalNotificationSeenAt([
    {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    },
  ])

  assert.equal(latestSeenAt, '2026-01-05T00:00:00.000Z')
})

test('TD portal notifications only count updates after the seen timestamp as unread', () => {
  const notifications = [
    {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-04T00:00:00.000Z',
    },
  ]

  assert.equal(isTDPortalNotificationUnread(notifications[0], '2026-01-03T00:00:00.000Z'), false)
  assert.equal(isTDPortalNotificationUnread(notifications[1], '2026-01-03T00:00:00.000Z'), true)
  assert.equal(getTDPortalUnreadCount(notifications, '2026-01-03T00:00:00.000Z'), 1)
  assert.equal(getTDPortalUnreadCount(notifications, null), 0)
})

test('TD portal request notifications exclude staff-derived tournament access', () => {
  assert.equal(
    isTDPortalRequestNotification({
      id: 'staff-staff-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    false,
  )

  assert.equal(
    isTDPortalRequestNotification({
      id: 'request-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    true,
  )
})
