import test from 'node:test'
import assert from 'node:assert/strict'
import TDPortalPage from '@/app/(app)/td/page'

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

function restoreAll(mocks: Array<{ mock: { restore: () => void } }>) {
  for (const item of mocks) {
    item.mock.restore()
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

async function getDeps() {
  const prismaModule = unwrapDefault(await import('@/lib/prisma'))
  const serverSessionModule = unwrapDefault(await import('@/lib/server-session'))
  const prisma = prismaModule?.prisma
  const serverSession = serverSessionModule?.serverSession
  if (!prisma || !serverSession || !(serverSession as { get?: unknown }).get) {
    throw new Error('Failed to resolve mocked dependencies')
  }
  return {
    prisma: prisma as Record<string, Record<string, unknown>>,
    serverSession: serverSession as Record<string, unknown>,
  }
}

function getElementProps(element: unknown) {
  if (!element || typeof element !== 'object' || !('props' in element)) {
    throw new Error('Expected a React element with props')
  }
  return (element as { props: Record<string, unknown> }).props
}

function makeInvite(overrides: Partial<{
  id: string
  email: string
  name: string | null
  role: 'TOURNAMENT_DIRECTOR'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  tournament: {
    id: string
    name: string
    division: string
    startDate: Date
    endDate: Date
    hostingRequestId: string | null
  }
}> = {}) {
  return {
    id: 'staff-td-2',
    email: 'director-two@example.com',
    name: 'Director Two',
    role: 'TOURNAMENT_DIRECTOR' as const,
    status: 'PENDING' as const,
    tournament: {
      id: 'tour-1',
      name: 'Regional Invite',
      division: 'C',
      startDate: new Date('2026-02-14T00:00:00.000Z'),
      endDate: new Date('2026-02-15T00:00:00.000Z'),
      hostingRequestId: null,
    },
    ...overrides,
  }
}

test('TD portal invite link shows invite details before sign-in', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(serverSession, 'get', async () => null as never),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findUnique',
      async () => makeInvite() as never,
    ),
  ]

  try {
    const page = await TDPortalPage({
      searchParams: Promise.resolve({ token: 'invite-token-1' }),
    })

    const props = getElementProps(page)
    assert.equal(props.token, 'invite-token-1')
    assert.equal((props.inviteInfo as { email: string }).email, 'director-two@example.com')
    assert.equal(
      (props.inviteInfo as { tournament: { name: string } }).tournament.name,
      'Regional Invite',
    )
  } finally {
    restoreAll(mocks)
  }
})

test('TD portal invite link auto-accepts a matching secondary TD and lists the tournament', async () => {
  const { prisma, serverSession } = await getDeps()
  let updatedData: Record<string, unknown> | null = null

  const mocks = [
    overrideMethod(
      serverSession,
      'get',
      async () =>
        ({
          user: {
            id: 'user-2',
            email: 'director-two@example.com',
            name: 'Director Two',
          },
        }) as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findUnique',
      async () => makeInvite() as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'update',
      async (args: unknown) => {
        updatedData = (args as { data: Record<string, unknown> }).data
        return {
          id: 'staff-td-2',
        } as never
      },
    ),
    overrideMethod(
      prisma.tournamentHostingRequest as Record<string, unknown>,
      'findMany',
      async () => [] as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'staff-td-2',
            email: 'director-two@example.com',
            name: 'Director Two',
            role: 'TOURNAMENT_DIRECTOR',
            status: 'ACCEPTED',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            tournament: {
              id: 'tour-1',
              name: 'Regional Invite',
              division: 'C',
              startDate: new Date('2026-02-14T00:00:00.000Z'),
              endDate: new Date('2026-02-15T00:00:00.000Z'),
            },
          },
        ] as never,
    ),
  ]

  try {
    const page = await TDPortalPage({
      searchParams: Promise.resolve({ token: 'invite-token-1' }),
    })

    assert.ok(updatedData)
    const updatedInvite = updatedData as { status?: string; userId?: string }
    assert.equal(updatedInvite.status, 'ACCEPTED')
    assert.equal(updatedInvite.userId, 'user-2')

    const props = getElementProps(page)
    const requests = props.requests as Array<{ id: string; tournament: { id: string } }>
    const accessibleTournaments = props.accessibleTournaments as Array<{
      id: string
      tournament: { id: string }
    }>
    assert.equal(requests.length, 0)
    assert.equal(accessibleTournaments.length, 1)
    assert.equal(accessibleTournaments[0].id, 'staff-staff-td-2')
    assert.equal(accessibleTournaments[0].tournament.id, 'tour-1')
  } finally {
    restoreAll(mocks)
  }
})

test('TD portal keeps request notifications scoped to the signed-in user while still showing invited tournaments', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(
      serverSession,
      'get',
      async () =>
        ({
          user: {
            id: 'user-2',
            email: 'director-two@example.com',
            name: 'Director Two',
          },
        }) as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findUnique',
      async () => null as never,
    ),
    overrideMethod(
      prisma.tournamentHostingRequest as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'request-1',
            tournamentName: 'Own Tournament Request',
            tournamentLevel: 'regional',
            division: 'B',
            tournamentFormat: 'in-person',
            location: 'Campus',
            preferredSlug: 'own-tournament-request',
            directorName: 'Director Two',
            directorEmail: 'director-two@example.com',
            directorPhone: null,
            otherNotes: null,
            status: 'PENDING',
            reviewNotes: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-03T00:00:00.000Z'),
            tournament: null,
          },
        ] as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'staff-td-2',
            email: 'director-two@example.com',
            name: 'Director Two',
            role: 'TOURNAMENT_DIRECTOR',
            status: 'ACCEPTED',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-04T00:00:00.000Z'),
            tournament: {
              id: 'tour-1',
              name: 'Regional Invite',
              division: 'C',
              startDate: new Date('2026-02-14T00:00:00.000Z'),
              endDate: new Date('2026-02-15T00:00:00.000Z'),
            },
          },
        ] as never,
    ),
  ]

  try {
    const page = await TDPortalPage({
      searchParams: Promise.resolve({}),
    })

    const props = getElementProps(page)
    const requests = props.requests as Array<{ id: string }>
    const accessibleTournaments = props.accessibleTournaments as Array<{ id: string }>

    assert.deepEqual(
      requests.map(request => request.id),
      ['request-1'],
    )
    assert.deepEqual(
      accessibleTournaments.map(request => request.id),
      ['request-1', 'staff-staff-td-2'],
    )
  } finally {
    restoreAll(mocks)
  }
})

test('TD portal invite link keeps the token when a different email is signed in', async () => {
  const { prisma, serverSession } = await getDeps()
  let updateCalled = false

  const mocks = [
    overrideMethod(
      serverSession,
      'get',
      async () =>
        ({
          user: {
            id: 'user-other',
            email: 'other@example.com',
            name: 'Other User',
          },
        }) as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findUnique',
      async () => makeInvite() as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'update',
      async () => {
        updateCalled = true
        return null as never
      },
    ),
    overrideMethod(
      prisma.tournamentHostingRequest as Record<string, unknown>,
      'findMany',
      async () => [] as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findMany',
      async () => [] as never,
    ),
  ]

  try {
    const page = await TDPortalPage({
      searchParams: Promise.resolve({ token: 'invite-token-1' }),
    })

    assert.equal(updateCalled, false)

    const props = getElementProps(page)
    assert.equal(props.unauthorized, true)
    assert.equal(props.email, 'other@example.com')
    assert.equal(props.token, 'invite-token-1')
    assert.equal((props.inviteInfo as { email: string }).email, 'director-two@example.com')
  } finally {
    restoreAll(mocks)
  }
})
