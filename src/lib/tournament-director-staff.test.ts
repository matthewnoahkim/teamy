import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ensureTournamentDirectorStaff,
  tournamentDirectorStaffDeps,
} from '@/lib/tournament-director-staff'

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
    if (current.prisma || current.isTournamentDirector) {
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
  const prisma = prismaModule?.prisma
  if (!prisma) {
    throw new Error('Failed to resolve mocked dependencies')
  }
  return {
    prisma: prisma as Record<string, Record<string, unknown>>,
  }
}

test('ensureTournamentDirectorStaff returns an existing accepted staff record', async () => {
  const { prisma } = await getDeps()

  const mocks = [
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findFirst',
      async () =>
        ({
          id: 'staff-existing',
          email: 'director@example.com',
          role: 'TOURNAMENT_DIRECTOR',
          status: 'ACCEPTED',
        }) as never,
    ),
  ]

  try {
    const result = await ensureTournamentDirectorStaff({
      tournamentId: 'tour-1',
      userId: 'user-1',
      userEmail: 'director@example.com',
      userName: 'Director',
    })

    assert.equal(result?.id, 'staff-existing')
  } finally {
    restoreAll(mocks)
  }
})

test('ensureTournamentDirectorStaff creates an accepted TD staff record when none exists yet', async () => {
  const { prisma } = await getDeps()
  let createdData: Record<string, unknown> | null = null

  const mocks = [
    overrideMethod(prisma.tournamentStaff as Record<string, unknown>, 'findFirst', async () => null as never),
    overrideMethod(tournamentDirectorStaffDeps as Record<string, unknown>, 'isTournamentDirector', async () => true as never),
    overrideMethod(prisma.tournamentStaff as Record<string, unknown>, 'findUnique', async () => null as never),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'create',
      async (args: unknown) => {
        createdData = (args as { data: Record<string, unknown> }).data
        return {
          id: 'staff-created',
          ...createdData,
        } as never
      },
    ),
  ]

  try {
    const result = await ensureTournamentDirectorStaff({
      tournamentId: 'tour-1',
      userId: 'user-1',
      userEmail: 'Director@Example.com',
      userName: 'Director',
    })

    assert.equal(result?.id, 'staff-created')
    assert.ok(createdData)
    const createdStaff = createdData as { role?: string; status?: string; email?: string; userId?: string }
    assert.equal(createdStaff.role, 'TOURNAMENT_DIRECTOR')
    assert.equal(createdStaff.status, 'ACCEPTED')
    assert.equal(createdStaff.email, 'director@example.com')
    assert.equal(createdStaff.userId, 'user-1')
  } finally {
    restoreAll(mocks)
  }
})

test('ensureTournamentDirectorStaff upgrades a pending TD invite to accepted when needed', async () => {
  const { prisma } = await getDeps()
  let updatedData: Record<string, unknown> | null = null

  const mocks = [
    overrideMethod(prisma.tournamentStaff as Record<string, unknown>, 'findFirst', async () => null as never),
    overrideMethod(tournamentDirectorStaffDeps as Record<string, unknown>, 'isTournamentDirector', async () => true as never),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'findUnique',
      async () =>
        ({
          id: 'staff-pending',
          email: 'director@example.com',
          name: null,
          role: 'TOURNAMENT_DIRECTOR',
          status: 'PENDING',
          acceptedAt: null,
        }) as never,
    ),
    overrideMethod(
      prisma.tournamentStaff as Record<string, unknown>,
      'update',
      async (args: unknown) => {
        updatedData = (args as { data: Record<string, unknown> }).data
        return {
          id: 'staff-pending',
          ...updatedData,
        } as never
      },
    ),
  ]

  try {
    const result = await ensureTournamentDirectorStaff({
      tournamentId: 'tour-1',
      userId: 'user-1',
      userEmail: 'director@example.com',
      userName: 'Director',
    })

    assert.equal(result?.id, 'staff-pending')
    assert.ok(updatedData)
    const updatedStaff = updatedData as { role?: string; status?: string; userId?: string; name?: string | null }
    assert.equal(updatedStaff.role, 'TOURNAMENT_DIRECTOR')
    assert.equal(updatedStaff.status, 'ACCEPTED')
    assert.equal(updatedStaff.userId, 'user-1')
    assert.equal(updatedStaff.name, 'Director')
  } finally {
    restoreAll(mocks)
  }
})
