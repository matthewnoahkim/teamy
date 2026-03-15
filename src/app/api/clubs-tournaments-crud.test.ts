import test from 'node:test'
import assert from 'node:assert/strict'
import { Role } from '@prisma/client'
import { GET as teamsGet, POST as teamsPost } from '@/app/api/clubs/[clubId]/teams/route'
import { GET as tournamentGet, PUT as tournamentPut, DELETE as tournamentDelete } from '@/app/api/tournaments/[tournamentId]/route'
import { PATCH as registrationPatch, DELETE as registrationDelete } from '@/app/api/tournaments/[tournamentId]/register/[registrationId]/route'

// ─── Helpers (same pattern as other route test files) ─────────────────────────

function overrideMethod(
  object: Record<string, unknown>,
  methodName: string,
  implementation: (...args: unknown[]) => unknown,
): { mock: { restore: () => void } } {
  const previous = object[methodName]
  object[methodName] = implementation
  return { mock: { restore: () => { object[methodName] = previous } } }
}

function restoreAll(mocks: Array<{ mock: { restore: () => void } }>) {
  for (const item of mocks) item.mock.restore()
}

function unwrapDefault(moduleValue: unknown): Record<string, unknown> | null {
  let current = moduleValue as Record<string, unknown> | undefined
  let guard = 0
  while (current && guard < 5) {
    if (current.prisma || current.serverSession) return current
    const next = current.default
    if (!next || typeof next !== 'object') return current
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

function makeRequest(url: string) {
  const parsed = new URL(url)
  return { url, nextUrl: parsed } as unknown as Request
}

function makeJsonRequest(url: string, body: unknown, method = 'POST') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Request
}

// Mock membership returned for a club member (non-admin)
function makeMemberMembership() {
  return { id: 'membership-1', role: Role.MEMBER, roles: [], userId: 'user-1', clubId: 'club-1', teamId: null }
}

// Mock membership returned for a club admin
function makeAdminMembership() {
  return { id: 'membership-1', role: Role.ADMIN, roles: [], userId: 'user-1', clubId: 'club-1', teamId: null }
}

// ─── Club Teams: GET ──────────────────────────────────────────────────────────

test('GET /api/clubs/[clubId]/teams returns 401 when unauthenticated', async () => {
  const { serverSession } = await getDeps()
  const mocks = [overrideMethod(serverSession, 'get', async () => null)]
  try {
    const response = await teamsGet(
      makeRequest('http://localhost/api/clubs/club-1/teams') as never,
      { params: Promise.resolve({ clubId: 'club-1' }) },
    )
    assert.equal(response.status, 401)
  } finally {
    restoreAll(mocks)
  }
})

test('GET /api/clubs/[clubId]/teams returns 403 for non-members', async () => {
  const { prisma, serverSession } = await getDeps()
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findUnique', async () => null as never),
  ]
  try {
    const response = await teamsGet(
      makeRequest('http://localhost/api/clubs/club-1/teams') as never,
      { params: Promise.resolve({ clubId: 'club-1' }) },
    )
    assert.equal(response.status, 403)
  } finally {
    restoreAll(mocks)
  }
})

test('GET /api/clubs/[clubId]/teams returns team list for members', async () => {
  const { prisma, serverSession } = await getDeps()
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findUnique', async () => makeMemberMembership() as never),
    overrideMethod(prisma.team as Record<string, unknown>, 'findMany', async () => [
      { id: 'team-1', name: 'Team Alpha', members: [], _count: { members: 3 } },
      { id: 'team-2', name: 'Team Beta',  members: [], _count: { members: 2 } },
    ] as never),
  ]
  try {
    const response = await teamsGet(
      makeRequest('http://localhost/api/clubs/club-1/teams') as never,
      { params: Promise.resolve({ clubId: 'club-1' }) },
    )
    assert.equal(response.status, 200)
    const data = (await response.json()) as { teams: Array<{ id: string }> }
    assert.deepEqual(data.teams.map(t => t.id), ['team-1', 'team-2'])
  } finally {
    restoreAll(mocks)
  }
})

// ─── Club Teams: POST ─────────────────────────────────────────────────────────

test('POST /api/clubs/[clubId]/teams returns 401 when unauthenticated', async () => {
  const { serverSession } = await getDeps()
  const mocks = [overrideMethod(serverSession, 'get', async () => null)]
  try {
    const response = await teamsPost(
      makeJsonRequest('http://localhost/api/clubs/club-1/teams', { name: 'New Team' }) as never,
      { params: Promise.resolve({ clubId: 'club-1' }) },
    )
    assert.equal(response.status, 401)
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/clubs/[clubId]/teams returns 403 for non-admins', async () => {
  const { prisma, serverSession } = await getDeps()
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findUnique', async () => makeMemberMembership() as never),
  ]
  try {
    const response = await teamsPost(
      makeJsonRequest('http://localhost/api/clubs/club-1/teams', { name: 'New Team' }) as never,
      { params: Promise.resolve({ clubId: 'club-1' }) },
    )
    assert.equal(response.status, 403)
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/clubs/[clubId]/teams creates team for admins', async () => {
  const { prisma, serverSession } = await getDeps()
  let createData: Record<string, unknown> | null = null
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findUnique', async () => makeAdminMembership() as never),
    overrideMethod(prisma.team as Record<string, unknown>, 'create', async (args: unknown) => {
      createData = (args as { data: Record<string, unknown> }).data
      return { id: 'new-team-1', name: 'New Team', clubId: 'club-1' } as never
    }),
  ]
  try {
    const response = await teamsPost(
      makeJsonRequest('http://localhost/api/clubs/club-1/teams', { name: 'New Team' }) as never,
      { params: Promise.resolve({ clubId: 'club-1' }) },
    )
    assert.equal(response.status, 200)
    assert.ok(createData)
    assert.equal(createData.name, 'New Team')
    assert.equal(createData.clubId, 'club-1')
    const data = (await response.json()) as { team: { id: string } }
    assert.equal(data.team.id, 'new-team-1')
  } finally {
    restoreAll(mocks)
  }
})

// ─── Tournament GET (disabled) ────────────────────────────────────────────────

test('GET /api/tournaments/[tournamentId] returns 503 (endpoint disabled)', async () => {
  const response = await tournamentGet()
  assert.equal(response.status, 503)
})

// ─── Tournament PUT ───────────────────────────────────────────────────────────

test('PUT /api/tournaments/[tournamentId] returns 401 when unauthenticated', async () => {
  const { serverSession } = await getDeps()
  const mocks = [overrideMethod(serverSession, 'get', async () => null)]
  try {
    const response = await tournamentPut(
      makeJsonRequest('http://localhost/api/tournaments/tour-1', { name: 'Updated' }, 'PUT') as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )
    assert.equal(response.status, 401)
  } finally {
    restoreAll(mocks)
  }
})

test('PUT /api/tournaments/[tournamentId] returns 403 for non-tournament-admins', async () => {
  const { prisma, serverSession } = await getDeps()
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => null as never),
  ]
  try {
    const response = await tournamentPut(
      makeJsonRequest('http://localhost/api/tournaments/tour-1', { name: 'Updated' }, 'PUT') as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )
    assert.equal(response.status, 403)
  } finally {
    restoreAll(mocks)
  }
})

test('PUT /api/tournaments/[tournamentId] updates fields for tournament admins', async () => {
  const { prisma, serverSession } = await getDeps()
  let updateArgs: Record<string, unknown> | null = null
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => ({ id: 'admin-1' }) as never),
    overrideMethod(prisma.tournament as Record<string, unknown>, 'update', async (args: unknown) => {
      updateArgs = args as Record<string, unknown>
      return { id: 'tour-1', name: 'Regional Invitational 2026' } as never
    }),
  ]
  try {
    const response = await tournamentPut(
      makeJsonRequest('http://localhost/api/tournaments/tour-1', { name: 'Regional Invitational 2026' }, 'PUT') as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )
    assert.equal(response.status, 200)
    assert.ok(updateArgs)
    const data = (updateArgs as { data: Record<string, unknown> }).data
    assert.equal(data.name, 'Regional Invitational 2026')
  } finally {
    restoreAll(mocks)
  }
})

test('PUT /api/tournaments/[tournamentId] does not allow setting approved field', async () => {
  const { prisma, serverSession } = await getDeps()
  let updateArgs: Record<string, unknown> | null = null
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => ({ id: 'admin-1' }) as never),
    overrideMethod(prisma.tournament as Record<string, unknown>, 'update', async (args: unknown) => {
      updateArgs = args as Record<string, unknown>
      return { id: 'tour-1', name: 'Test' } as never
    }),
  ]
  try {
    const response = await tournamentPut(
      makeJsonRequest('http://localhost/api/tournaments/tour-1', { name: 'Test', approved: true }, 'PUT') as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )
    assert.equal(response.status, 200)
    // approved must never appear in the DB update payload
    const data = (updateArgs as { data: Record<string, unknown> }).data
    assert.equal('approved' in data, false)
  } finally {
    restoreAll(mocks)
  }
})

// ─── Tournament DELETE ────────────────────────────────────────────────────────

test('DELETE /api/tournaments/[tournamentId] returns 401 when unauthenticated', async () => {
  const { serverSession } = await getDeps()
  const mocks = [overrideMethod(serverSession, 'get', async () => null)]
  try {
    const response = await tournamentDelete(
      new Request('http://localhost/api/tournaments/tour-1', { method: 'DELETE' }) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )
    assert.equal(response.status, 401)
  } finally {
    restoreAll(mocks)
  }
})

test('DELETE /api/tournaments/[tournamentId] returns 403 for non-tournament-admins', async () => {
  const { prisma, serverSession } = await getDeps()
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => null as never),
  ]
  try {
    const response = await tournamentDelete(
      new Request('http://localhost/api/tournaments/tour-1', { method: 'DELETE' }) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )
    assert.equal(response.status, 403)
  } finally {
    restoreAll(mocks)
  }
})

test('DELETE /api/tournaments/[tournamentId] deletes tournament for tournament admins', async () => {
  const { prisma, serverSession } = await getDeps()
  let deleteWhere: Record<string, unknown> | null = null
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => ({ id: 'admin-1' }) as never),
    overrideMethod(prisma.tournament as Record<string, unknown>, 'delete', async (args: unknown) => {
      deleteWhere = (args as { where: Record<string, unknown> }).where
      return { id: 'tour-1' } as never
    }),
  ]
  try {
    const response = await tournamentDelete(
      new Request('http://localhost/api/tournaments/tour-1', { method: 'DELETE' }) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )
    assert.equal(response.status, 200)
    assert.deepEqual(deleteWhere, { id: 'tour-1' })
    const data = (await response.json()) as { success: boolean }
    assert.equal(data.success, true)
  } finally {
    restoreAll(mocks)
  }
})

// ─── Tournament Registration: PATCH (update paid status) ─────────────────────

test('PATCH /api/tournaments/[tournamentId]/register/[registrationId] returns 401 when unauthenticated', async () => {
  const { serverSession } = await getDeps()
  const mocks = [overrideMethod(serverSession, 'get', async () => null)]
  try {
    const response = await registrationPatch(
      makeJsonRequest('http://localhost/api/tournaments/tour-1/register/reg-1', { paid: true }, 'PATCH') as never,
      { params: Promise.resolve({ tournamentId: 'tour-1', registrationId: 'reg-1' }) },
    )
    assert.equal(response.status, 401)
  } finally {
    restoreAll(mocks)
  }
})

test('PATCH /api/tournaments/[tournamentId]/register/[registrationId] returns 403 for non-tournament-admins', async () => {
  const { prisma, serverSession } = await getDeps()
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => null as never),
  ]
  try {
    const response = await registrationPatch(
      makeJsonRequest('http://localhost/api/tournaments/tour-1/register/reg-1', { paid: true }, 'PATCH') as never,
      { params: Promise.resolve({ tournamentId: 'tour-1', registrationId: 'reg-1' }) },
    )
    assert.equal(response.status, 403)
  } finally {
    restoreAll(mocks)
  }
})

test('PATCH /api/tournaments/[tournamentId]/register/[registrationId] updates paid status for tournament admins', async () => {
  const { prisma, serverSession } = await getDeps()
  let updateData: Record<string, unknown> | null = null
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => ({ id: 'admin-1' }) as never),
    overrideMethod(prisma.tournamentRegistration as Record<string, unknown>, 'findUnique', async () => ({
      id: 'reg-1', tournamentId: 'tour-1', clubId: 'club-1', teamId: null, paid: false,
    }) as never),
    overrideMethod(prisma.tournamentRegistration as Record<string, unknown>, 'update', async (args: unknown) => {
      updateData = (args as { data: Record<string, unknown> }).data
      return { id: 'reg-1', tournamentId: 'tour-1', paid: true } as never
    }),
  ]
  try {
    const response = await registrationPatch(
      makeJsonRequest('http://localhost/api/tournaments/tour-1/register/reg-1', { paid: true }, 'PATCH') as never,
      { params: Promise.resolve({ tournamentId: 'tour-1', registrationId: 'reg-1' }) },
    )
    assert.equal(response.status, 200)
    assert.ok(updateData)
    assert.equal(updateData.paid, true)
  } finally {
    restoreAll(mocks)
  }
})

test('PATCH /api/tournaments/[tournamentId]/register/[registrationId] rejects registration from wrong tournament', async () => {
  const { prisma, serverSession } = await getDeps()
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentAdmin as Record<string, unknown>, 'findUnique', async () => ({ id: 'admin-1' }) as never),
    overrideMethod(prisma.tournamentRegistration as Record<string, unknown>, 'findUnique', async () => ({
      id: 'reg-1', tournamentId: 'different-tour', clubId: 'club-1', teamId: null, paid: false,
    }) as never),
  ]
  try {
    const response = await registrationPatch(
      makeJsonRequest('http://localhost/api/tournaments/tour-1/register/reg-1', { paid: true }, 'PATCH') as never,
      { params: Promise.resolve({ tournamentId: 'tour-1', registrationId: 'reg-1' }) },
    )
    assert.equal(response.status, 400)
  } finally {
    restoreAll(mocks)
  }
})

// ─── Tournament Registration: DELETE (deregister) ────────────────────────────

test('DELETE /api/tournaments/[tournamentId]/register/[registrationId] returns 401 when unauthenticated', async () => {
  const { serverSession } = await getDeps()
  const mocks = [overrideMethod(serverSession, 'get', async () => null)]
  try {
    const response = await registrationDelete(
      new Request('http://localhost/api/tournaments/tour-1/register/reg-1', { method: 'DELETE' }) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1', registrationId: 'reg-1' }) },
    )
    assert.equal(response.status, 401)
  } finally {
    restoreAll(mocks)
  }
})

test('DELETE /api/tournaments/[tournamentId]/register/[registrationId] returns 403 for non-club-admins', async () => {
  const { prisma, serverSession } = await getDeps()
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentRegistration as Record<string, unknown>, 'findUnique', async () => ({
      id: 'reg-1', tournamentId: 'tour-1', clubId: 'club-1', teamId: null,
      team: null, club: { id: 'club-1', name: 'Club 1' },
    }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findUnique', async () => makeMemberMembership() as never),
  ]
  try {
    const response = await registrationDelete(
      new Request('http://localhost/api/tournaments/tour-1/register/reg-1', { method: 'DELETE' }) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1', registrationId: 'reg-1' }) },
    )
    assert.equal(response.status, 403)
  } finally {
    restoreAll(mocks)
  }
})

test('DELETE /api/tournaments/[tournamentId]/register/[registrationId] deregisters for club admins', async () => {
  const { prisma, serverSession } = await getDeps()
  let deleteWhere: Record<string, unknown> | null = null
  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournamentRegistration as Record<string, unknown>, 'findUnique', async () => ({
      id: 'reg-1', tournamentId: 'tour-1', clubId: 'club-1', teamId: null,
      team: null, club: { id: 'club-1', name: 'Club 1' },
    }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findUnique', async () => makeAdminMembership() as never),
    overrideMethod(prisma.tournamentRegistration as Record<string, unknown>, 'delete', async (args: unknown) => {
      deleteWhere = (args as { where: Record<string, unknown> }).where
      return { id: 'reg-1' } as never
    }),
  ]
  try {
    const response = await registrationDelete(
      new Request('http://localhost/api/tournaments/tour-1/register/reg-1', { method: 'DELETE' }) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1', registrationId: 'reg-1' }) },
    )
    assert.equal(response.status, 200)
    assert.deepEqual(deleteWhere, { id: 'reg-1' })
    const data = (await response.json()) as { success: boolean }
    assert.equal(data.success, true)
  } finally {
    restoreAll(mocks)
  }
})
