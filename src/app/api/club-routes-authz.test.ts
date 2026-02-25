import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { Role, TestAssignmentScope } from '@prisma/client'
import { GET as announcementsGet } from '@/app/api/announcements/route'
import { GET as testsGet } from '@/app/api/tests/route'
import { GET as notificationsGet } from '@/app/api/clubs/[clubId]/notifications/route'

const mockMethod = mock.method.bind(mock) as unknown as (
  object: object,
  methodName: string,
  implementation?: (...args: unknown[]) => unknown,
) => { mock: { restore: () => void } }

function overrideMethod(
  object: Record<string, unknown>,
  methodName: string,
  implementation: (...args: unknown[]) => unknown,
): { mock: { restore: () => void } } {
  const previous = object[methodName]
  object[methodName] = implementation
  return {
    mock: {
      restore: () => {
        object[methodName] = previous
      },
    },
  }
}

function unwrapDefault(moduleValue: unknown): Record<string, unknown> | null {
  let current = moduleValue as Record<string, unknown> | undefined
  let guard = 0
  while (current && guard < 5) {
    if (current.prisma || current.serverSession) {
      return current
    }
    const next = current.default
    if (!next || typeof next !== 'object') {
      return current
    }
    current = next as Record<string, unknown>
    guard += 1
  }
  return current ?? null
}

async function getTestDeps() {
  const prismaModule = unwrapDefault(await import('@/lib/prisma'))
  const serverSessionModule = unwrapDefault(await import('@/lib/server-session'))

  const prisma = prismaModule?.prisma
  const serverSession = serverSessionModule?.serverSession

  if (!prisma || !serverSession || !(serverSession as { get?: unknown }).get) {
    throw new Error('Failed to resolve test dependencies for route mocks')
  }

  return {
    prisma: prisma as Record<string, unknown>,
    serverSession: serverSession as { get: () => unknown },
  }
}

function restoreAll(mocks: Array<{ mock: { restore: () => void } }>) {
  for (const item of mocks) {
    item.mock.restore()
  }
}

function makeRequest(url: string) {
  const parsed = new URL(url)
  return {
    url,
    nextUrl: parsed,
  } as unknown as Request
}

test('GET /api/announcements returns 401 when unauthenticated', async () => {
  const { serverSession } = await getTestDeps()
  const mocks = [
    mockMethod(serverSession, 'get', async () => null),
  ]
  try {
    const response = await announcementsGet(makeRequest('http://localhost/api/announcements?clubId=club-1') as never)
    assert.equal(response.status, 401)
  } finally {
    restoreAll(mocks)
  }
})

test('GET /api/announcements filters role/event-targeted announcements for non-admins', async () => {
  const { prisma, serverSession } = await getTestDeps()
  const prismaAny = prisma as Record<string, { [key: string]: unknown }>
  const mocks = [
    mockMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prismaAny.membership as Record<string, unknown>,
      'findUnique',
      async () => {
        return {
          id: 'membership-1',
          userId: 'user-1',
          clubId: 'club-1',
          role: Role.MEMBER,
          roles: [],
          teamId: 'team-1',
        } as never
      },
    ),
    overrideMethod(prismaAny.rosterAssignment as Record<string, unknown>, 'findMany', async () => [{ eventId: 'event-1' }] as never),
    overrideMethod(
      prismaAny.announcement as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'a-public',
            visibilities: [{ targetRole: null, eventId: null }],
          },
          {
            id: 'a-captain',
            visibilities: [{ targetRole: 'CAPTAIN', eventId: null }],
          },
          {
            id: 'a-event',
            visibilities: [{ targetRole: null, eventId: 'event-1' }],
          },
        ] as never,
    ),
  ]
  try {
    const response = await announcementsGet(makeRequest('http://localhost/api/announcements?clubId=club-1') as never)
    assert.equal(response.status, 200)
    const data = (await response.json()) as { announcements: Array<{ id: string }> }
    assert.deepEqual(
      data.announcements.map(announcement => announcement.id),
      ['a-public', 'a-event'],
    )
  } finally {
    restoreAll(mocks)
  }
})

test('GET /api/tests returns 403 when user is not a club member', async () => {
  const { prisma, serverSession } = await getTestDeps()
  const prismaAny = prisma as Record<string, { [key: string]: unknown }>
  const mocks = [
    mockMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prismaAny.membership as Record<string, unknown>, 'findUnique', async () => null as never),
  ]
  try {
    const response = await testsGet(makeRequest('http://localhost/api/tests?clubId=club-1') as never)
    assert.equal(response.status, 403)
  } finally {
    restoreAll(mocks)
  }
})

test('GET /api/tests filters tests by assignment visibility for non-admins', async () => {
  const { prisma, serverSession } = await getTestDeps()
  const prismaAny = prisma as Record<string, { [key: string]: unknown }>
  const mocks = [
    mockMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prismaAny.membership as Record<string, unknown>,
      'findUnique',
      async () => {
        return {
          id: 'membership-1',
          userId: 'user-1',
          clubId: 'club-1',
          role: Role.MEMBER,
          roles: [],
          teamId: 'team-1',
        } as never
      },
    ),
    overrideMethod(
      prismaAny.test as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 't-club',
            createdByMembershipId: 'creator-1',
            assignments: [
              {
                assignedScope: TestAssignmentScope.CLUB,
                teamId: null,
                targetMembershipId: null,
                eventId: null,
              },
            ],
            maxAttempts: null,
            allowNoteSheet: false,
            startAt: null,
          },
          {
            id: 't-team-miss',
            createdByMembershipId: 'creator-1',
            assignments: [
              {
                assignedScope: TestAssignmentScope.TEAM,
                teamId: 'team-2',
                targetMembershipId: null,
                eventId: null,
              },
            ],
            maxAttempts: null,
            allowNoteSheet: false,
            startAt: null,
          },
          {
            id: 't-event-hit',
            createdByMembershipId: 'creator-1',
            assignments: [
              {
                assignedScope: TestAssignmentScope.PERSONAL,
                teamId: null,
                targetMembershipId: null,
                eventId: 'event-1',
              },
            ],
            maxAttempts: null,
            allowNoteSheet: false,
            startAt: null,
          },
        ] as never,
    ),
    overrideMethod(prismaAny.membership as Record<string, unknown>, 'findMany', async () => [] as never),
    overrideMethod(prismaAny.rosterAssignment as Record<string, unknown>, 'findMany', async () => [{ eventId: 'event-1' }] as never),
    overrideMethod(prismaAny.testAttempt as Record<string, unknown>, 'groupBy', async () => [] as never),
  ]
  try {
    const response = await testsGet(makeRequest('http://localhost/api/tests?clubId=club-1') as never)
    assert.equal(response.status, 200)
    const data = (await response.json()) as { tests: Array<{ id: string }> }
    assert.deepEqual(
      data.tests.map(testItem => testItem.id),
      ['t-club', 't-event-hit'],
    )
  } finally {
    restoreAll(mocks)
  }
})

test('GET /api/clubs/[clubId]/notifications returns 401 when unauthenticated', async () => {
  const { serverSession } = await getTestDeps()
  const mocks = [
    mockMethod(serverSession, 'get', async () => null),
  ]
  try {
    const response = await notificationsGet(
      makeRequest('http://localhost/api/clubs/club-1/notifications?tabs=stream') as never,
      { params: Promise.resolve({ clubId: 'club-1' }) },
    )
    assert.equal(response.status, 401)
  } finally {
    restoreAll(mocks)
  }
})

test('GET /api/clubs/[clubId]/notifications stream checks enforce target visibility', async () => {
  const { prisma, serverSession } = await getTestDeps()
  const prismaAny = prisma as Record<string, { [key: string]: unknown }>
  const mocks = [
    mockMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prismaAny.membership as Record<string, unknown>,
      'findUnique',
      async () =>
        ({
          id: 'membership-1',
          userId: 'user-1',
          teamId: 'team-1',
          role: Role.MEMBER,
          roles: [],
        }) as never,
    ),
    overrideMethod(prismaAny.rosterAssignment as Record<string, unknown>, 'findMany', async () => [] as never),
    overrideMethod(
      prismaAny.announcement as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'stream-captain-only',
            visibilities: [{ targetRole: 'CAPTAIN', eventId: null }],
          },
        ] as never,
    ),
  ]
  try {
    const response = await notificationsGet(
      makeRequest('http://localhost/api/clubs/club-1/notifications?tabs=stream&streamSince=1970-01-01T00:00:00.000Z') as never,
      { params: Promise.resolve({ clubId: 'club-1' }) },
    )
    assert.equal(response.status, 200)
    const data = (await response.json()) as { notifications: { stream: boolean } }
    assert.equal(data.notifications.stream, false)
  } finally {
    restoreAll(mocks)
  }
})
