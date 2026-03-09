import test from 'node:test'
import assert from 'node:assert/strict'
import { POST as ageVerificationPost } from '@/app/api/user/age-verification/route'

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

function makeJsonRequest(body: unknown) {
  return new Request('http://localhost/api/user/age-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }) as unknown as Request
}

test('POST /api/user/age-verification recreates a missing session user during DB recovery', async () => {
  const { prisma, serverSession } = await getDeps()
  let upsertArgs: Record<string, unknown> | null = null

  const mocks = [
    overrideMethod(
      serverSession,
      'get',
      async () =>
        ({
          user: {
            id: 'user-stale',
            email: 'recover@example.com',
            name: 'Recovered User',
            image: 'https://example.com/avatar.png',
          },
        }) as never
    ),
    overrideMethod(prisma.user as Record<string, unknown>, 'findUnique', async () => null as never),
    overrideMethod(prisma.user as Record<string, unknown>, 'upsert', async (args: unknown) => {
      upsertArgs = args as Record<string, unknown>
      return { id: 'user-stale' } as never
    }),
  ]

  try {
    const response = await ageVerificationPost(
      makeJsonRequest({
        birthMonth: 2,
        birthYear: 2004,
        parentConsent: false,
      }) as never
    )

    assert.equal(response.status, 200)

    const payload = (await response.json()) as { success: boolean; isUnder13: boolean }
    assert.deepEqual(payload, { success: true, isUnder13: false })

    assert.ok(upsertArgs)
    const createInput = upsertArgs.create as {
      id: string
      email: string
      name: string | null
      image: string | null
      preferences: { ageVerification: Record<string, unknown> }
    }
    assert.equal(createInput.id, 'user-stale')
    assert.equal(createInput.email, 'recover@example.com')
    assert.equal(createInput.name, 'Recovered User')
    assert.equal(createInput.image, 'https://example.com/avatar.png')
    assert.equal(createInput.preferences.ageVerification.birthMonth, 2)
    assert.equal(createInput.preferences.ageVerification.birthYear, 2004)
    assert.equal(createInput.preferences.ageVerification.parentConsent, false)
    assert.equal(typeof createInput.preferences.ageVerification.verifiedAt, 'string')
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/user/age-verification asks the user to sign in again when session recovery conflicts', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(
      serverSession,
      'get',
      async () =>
        ({
          user: {
            id: 'user-stale',
            email: 'recover@example.com',
          },
        }) as never
    ),
    overrideMethod(prisma.user as Record<string, unknown>, 'findUnique', async () => null as never),
    overrideMethod(prisma.user as Record<string, unknown>, 'upsert', async () => {
      throw { code: 'P2002' }
    }),
  ]

  try {
    const response = await ageVerificationPost(
      makeJsonRequest({
        birthMonth: 2,
        birthYear: 2004,
        parentConsent: false,
      }) as never
    )

    assert.equal(response.status, 409)
    const payload = (await response.json()) as { error: string }
    assert.match(payload.error, /sign in again/i)
  } finally {
    restoreAll(mocks)
  }
})
