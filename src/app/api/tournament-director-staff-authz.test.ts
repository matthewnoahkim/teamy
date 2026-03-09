import test from 'node:test'
import assert from 'node:assert/strict'
import { POST as staffPost } from '@/app/api/tournaments/[tournamentId]/staff/route'
import { PATCH as settingsPatch } from '@/app/api/tournaments/[tournamentId]/settings/route'

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

function makeJsonRequest(url: string, body: unknown, method = 'POST') {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }) as unknown as Request
}

test('POST /api/tournaments/[tournamentId]/staff lets an accepted secondary TD invite another TD', async () => {
  const { prisma, serverSession } = await getDeps()
  let createdData: Record<string, unknown> | null = null

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
    overrideMethod(prisma.tournament as Record<string, unknown>, 'findUnique', async () => ({
      id: 'tour-1',
      name: 'Tournament 1',
      createdById: 'creator-1',
    }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => null as never),
    overrideMethod(
      prisma.tournamentHostingRequest as Record<string, unknown>,
      'findFirst',
      async () => null as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findFirst',
      async () =>
        ({
          id: 'staff-td-2',
          role: 'TOURNAMENT_DIRECTOR',
          status: 'ACCEPTED',
          userId: 'user-2',
          email: 'director-two@example.com',
        }) as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findUnique',
      async () => null as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'create',
      async (args: unknown) => {
        createdData = (args as { data: Record<string, unknown> }).data
        return {
          id: 'staff-new',
          email: 'director-three@example.com',
          name: 'Director Three',
          role: 'TOURNAMENT_DIRECTOR',
          trialEvents: null,
          events: [],
        } as never
      },
    ),
  ]

  try {
    const response = await staffPost(
      makeJsonRequest('http://localhost/api/tournaments/tour-1/staff', {
        email: 'director-three@example.com',
        name: 'Director Three',
        role: 'TOURNAMENT_DIRECTOR',
      }) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )

    assert.equal(response.status, 200)
    assert.ok(createdData)
    const createdStaff = createdData as { role?: string; email?: string }
    assert.equal(createdStaff.role, 'TOURNAMENT_DIRECTOR')
    assert.equal(createdStaff.email, 'director-three@example.com')
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/tournaments/[tournamentId]/staff still blocks event supervisors from inviting directors', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(
      serverSession,
      'get',
      async () =>
        ({
          user: {
            id: 'user-es',
            email: 'es@example.com',
          },
        }) as never,
    ),
    overrideMethod(prisma.tournament as Record<string, unknown>, 'findUnique', async () => ({
      id: 'tour-1',
      name: 'Tournament 1',
      createdById: 'creator-1',
    }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => null as never),
    overrideMethod(
      prisma.tournamentHostingRequest as Record<string, unknown>,
      'findFirst',
      async () => null as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findFirst',
      async () => null as never,
    ),
  ]

  try {
    const response = await staffPost(
      makeJsonRequest('http://localhost/api/tournaments/tour-1/staff', {
        email: 'director-three@example.com',
        role: 'TOURNAMENT_DIRECTOR',
      }) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )

    assert.equal(response.status, 403)
    const payload = (await response.json()) as { error: string }
    assert.equal(payload.error, 'Not authorized to invite staff')
  } finally {
    restoreAll(mocks)
  }
})

test('PATCH /api/tournaments/[tournamentId]/settings lets an accepted secondary TD update settings', async () => {
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
          },
        }) as never,
    ),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => null as never),
    overrideMethod(prisma.tournament as Record<string, unknown>, 'findUnique', async () => ({
      id: 'tour-1',
      createdById: 'creator-1',
    }) as never),
    overrideMethod(
      prisma.tournamentHostingRequest as Record<string, unknown>,
      'findFirst',
      async () => null as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findFirst',
      async () =>
        ({
          id: 'staff-td-2',
          role: 'TOURNAMENT_DIRECTOR',
          status: 'ACCEPTED',
          userId: 'user-2',
          email: 'director-two@example.com',
        }) as never,
    ),
    overrideMethod(
      prisma.tournament as Record<string, unknown>,
      'update',
      async (args: unknown) => {
        updatedData = (args as { data: Record<string, unknown> }).data
        return {
          id: 'tour-1',
          ...updatedData,
        } as never
      },
    ),
  ]

  try {
    const response = await settingsPatch(
      makeJsonRequest(
        'http://localhost/api/tournaments/tour-1/settings',
        { eligibilityRequirements: 'None' },
        'PATCH',
      ) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )

    assert.equal(response.status, 200)
    assert.ok(updatedData)
    const updatedTournament = updatedData as { eligibilityRequirements?: string }
    assert.equal(updatedTournament.eligibilityRequirements, 'None')
  } finally {
    restoreAll(mocks)
  }
})
