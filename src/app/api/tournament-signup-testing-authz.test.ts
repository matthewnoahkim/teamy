import test from 'node:test'
import assert from 'node:assert/strict'
import { POST as registerPost } from '@/app/api/tournaments/[tournamentId]/register/route'
import { GET as testingTournamentsGet } from '@/app/api/testing/tournaments/route'
import { POST as startAttemptPost } from '@/app/api/tests/[testId]/attempts/start/route'
import { POST as clubProctorEventPost } from '@/app/api/tests/[testId]/attempts/[attemptId]/proctor-events/route'
import { POST as esProctorEventPost } from '@/app/api/es/tests/[testId]/attempts/[attemptId]/proctor-events/route'

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
    if (current.prisma) {
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

function makeTournamentTest(testId: string, eventId: string | null, name: string) {
  return {
    testId,
    eventId,
    event: eventId
      ? {
          id: eventId,
          name: `Event ${eventId}`,
          slug: `event-${eventId}`,
        }
      : null,
    test: {
      id: testId,
      name,
      description: null,
      instructions: null,
      status: 'PUBLISHED',
      durationMinutes: 50,
      startAt: null,
      endAt: null,
      allowLateUntil: null,
      requireFullscreen: true,
      allowCalculator: false,
      calculatorType: null,
      allowNoteSheet: false,
      noteSheetInstructions: null,
      maxAttempts: null,
      scoreReleaseMode: 'FULL_TEST',
      releaseScoresAt: null,
      clubId: 'club-1',
      club: {
        id: 'club-1',
        name: 'Club 1',
      },
      _count: {
        questions: 10,
      },
    },
  }
}

test('POST /api/tournaments/[tournamentId]/register rejects member assignments outside selected team', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournament as Record<string, unknown>, 'findUnique', async () => ({
      id: 'tour-1',
      division: 'C',
      trialEvents: null,
      hostingRequest: null,
    }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findUnique', async () => ({
      id: 'admin-membership',
      role: 'ADMIN',
      club: { name: 'Club 1' },
    }) as never),
    overrideMethod(prisma.team as Record<string, unknown>, 'findFirst', async () => ({ id: 'team-1' }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findMany', async () => [{ id: 'member-on-team' }] as never),
    overrideMethod(prisma.tournamentRegistration as Record<string, unknown>, 'findFirst', async () => null as never),
    overrideMethod(prisma.event as Record<string, unknown>, 'findMany', async () => [{ id: 'event-1' }] as never),
  ]

  try {
    const response = await registerPost(
      makeJsonRequest(
        'http://localhost/api/tournaments/tour-1/register',
        {
          clubId: 'club-1',
          teamIds: ['team-1'],
          teamSelections: {
            'team-1': {
              memberAssignments: [
                {
                  membershipId: 'outside-member',
                  eventIds: ['event-1'],
                },
              ],
            },
          },
        }
      ) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )

    assert.equal(response.status, 400)
    const payload = (await response.json()) as { error: string }
    assert.match(payload.error, /not on the selected team/i)
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/tournaments/[tournamentId]/register persists member event assignments', async () => {
  const { prisma, serverSession } = await getDeps()
  let createInput: Record<string, unknown> | null = null

  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(prisma.tournament as Record<string, unknown>, 'findUnique', async () => ({
      id: 'tour-1',
      division: 'C',
      trialEvents: null,
      hostingRequest: null,
    }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findUnique', async () => ({
      id: 'admin-membership',
      role: 'ADMIN',
      club: { name: 'Club 1' },
    }) as never),
    overrideMethod(prisma.team as Record<string, unknown>, 'findFirst', async () => ({ id: 'team-1' }) as never),
    overrideMethod(prisma.membership as Record<string, unknown>, 'findMany', async () => [{ id: 'member-1' }] as never),
    overrideMethod(prisma.tournamentRegistration as Record<string, unknown>, 'findFirst', async () => null as never),
    overrideMethod(prisma.event as Record<string, unknown>, 'findMany', async () => [{ id: 'event-1' }] as never),
    overrideMethod(
      prisma.tournamentRegistration as Record<string, unknown>,
      'create',
      async (args: unknown) => {
        createInput = args as Record<string, unknown>
        return {
          id: 'registration-1',
          club: { id: 'club-1', name: 'Club 1', division: 'C' },
          team: { id: 'team-1', name: 'Team 1' },
          eventSelections: [
            {
              event: {
                id: 'event-1',
                name: 'Anatomy',
                slug: 'anatomy',
              },
            },
          ],
          trialEventSelections: [],
          memberEventAssignments: [{ membershipId: 'member-1', eventId: 'event-1' }],
          memberTrialEventAssignments: [],
        } as never
      },
    ),
  ]

  try {
    const response = await registerPost(
      makeJsonRequest(
        'http://localhost/api/tournaments/tour-1/register',
        {
          clubId: 'club-1',
          teamIds: ['team-1'],
          teamSelections: {
            'team-1': {
              memberAssignments: [
                {
                  membershipId: 'member-1',
                  eventIds: ['event-1'],
                },
              ],
            },
          },
        }
      ) as never,
      { params: Promise.resolve({ tournamentId: 'tour-1' }) },
    )

    assert.equal(response.status, 200)
    assert.ok(createInput)
    const data = (createInput as { data: Record<string, unknown> }).data
    const memberAssignments = data.memberEventAssignments as { create: Array<{ membershipId: string; eventId: string }> }
    assert.deepEqual(memberAssignments.create, [{ membershipId: 'member-1', eventId: 'event-1' }])
  } finally {
    restoreAll(mocks)
  }
})

test('GET /api/testing/tournaments returns only assigned event and trial tests for member', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prisma.membership as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'membership-1',
            userId: 'user-1',
            clubId: 'club-1',
            teamId: 'team-1',
            club: { id: 'club-1', name: 'Club 1', division: 'C' },
            team: { id: 'team-1', name: 'Team 1' },
          },
        ] as never,
    ),
    overrideMethod(
      prisma.tournamentRegistration as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'registration-1',
            tournamentId: 'tour-1',
            clubId: 'club-1',
            teamId: 'team-1',
            tournament: {
              id: 'tour-1',
              name: 'Tournament 1',
              division: 'C',
              startDate: new Date('2026-03-01T09:00:00.000Z'),
              endDate: new Date('2026-03-01T18:00:00.000Z'),
              endTime: new Date('1970-01-01T18:00:00.000Z'),
              location: 'Online',
              slug: 'tour-1',
              trialEvents: JSON.stringify([
                { name: 'Robot Skills', division: 'C' },
                { name: 'Forensics Trial', division: 'C' },
              ]),
            },
            team: { id: 'team-1', name: 'Team 1' },
            club: { id: 'club-1', name: 'Club 1' },
          },
        ] as never,
    ),
    overrideMethod(
      prisma.tournamentMemberEventAssignment as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            event: {
              id: 'event-1',
              name: 'Anatomy',
              slug: 'anatomy',
              division: 'C',
            },
          },
        ] as never,
    ),
    overrideMethod(
      prisma.tournamentMemberTrialEventAssignment as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            eventName: 'Robot Skills',
            eventDivision: 'C',
          },
        ] as never,
    ),
    overrideMethod(
      prisma.tournamentTest as Record<string, unknown>,
      'findMany',
      async () =>
        [
          makeTournamentTest('test-event', 'event-1', 'Assigned Event Test'),
          makeTournamentTest('test-trial-assigned', null, 'Assigned Trial Test'),
          makeTournamentTest('test-trial-unassigned', null, 'Unassigned Trial Test'),
          makeTournamentTest('test-general', null, 'General Test'),
        ] as never,
    ),
    overrideMethod(prisma.eSTest as Record<string, unknown>, 'findMany', async () => [] as never),
    overrideMethod(prisma.testAttempt as Record<string, unknown>, 'findMany', async () => [] as never),
    overrideMethod(prisma.testAudit as Record<string, unknown>, 'findMany', async () => [
      { testId: 'test-trial-assigned', details: { eventName: 'Robot Skills' } },
      { testId: 'test-trial-unassigned', details: { eventName: 'Forensics Trial' } },
    ] as never),
  ]

  try {
    const response = await testingTournamentsGet(
      new Request('http://localhost/api/testing/tournaments') as never
    )
    assert.equal(response.status, 200)

    const payload = (await response.json()) as {
      tournaments: Array<{
        events: Array<{ event: { id: string }; tests: Array<{ id: string }> }>
        trialEvents: Array<{ event: { name: string }; tests: Array<{ id: string }> }>
        generalTests: Array<{ id: string }>
      }>
    }

    assert.equal(payload.tournaments.length, 1)
    assert.deepEqual(payload.tournaments[0].events.map((item) => item.event.id), ['event-1'])
    assert.deepEqual(
      payload.tournaments[0].events[0].tests.map((testItem) => testItem.id),
      ['test-event']
    )
    assert.deepEqual(
      payload.tournaments[0].trialEvents.map((item) => item.event.name),
      ['Robot Skills']
    )
    assert.deepEqual(
      payload.tournaments[0].trialEvents[0].tests.map((testItem) => testItem.id),
      ['test-trial-assigned']
    )
    assert.deepEqual(
      payload.tournaments[0].generalTests.map((testItem) => testItem.id),
      ['test-general']
    )
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/tests/[testId]/attempts/start blocks unassigned tournament event access', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prisma.tournamentTest as Record<string, unknown>,
      'findFirst',
      async () =>
        ({
          tournament: { id: 'tour-1' },
          eventId: 'event-1',
          test: {
            id: 'test-1',
            clubId: 'club-1',
            status: 'PUBLISHED',
            testPasswordHash: null,
            maxAttempts: null,
            startAt: null,
            endAt: null,
            allowLateUntil: null,
            assignments: [],
          },
        }) as never,
    ),
    overrideMethod(
      prisma.membership as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'membership-1',
            clubId: 'club-1',
            teamId: 'team-1',
            club: { id: 'club-1' },
            team: { id: 'team-1' },
          },
        ] as never,
    ),
    overrideMethod(
      prisma.tournamentRegistration as Record<string, unknown>,
      'findFirst',
      async () =>
        ({
          id: 'registration-1',
          clubId: 'club-1',
          teamId: 'team-1',
          trialEventSelections: [],
        }) as never,
    ),
    overrideMethod(
      prisma.tournamentMemberEventAssignment as Record<string, unknown>,
      'findFirst',
      async () => null as never,
    ),
  ]

  try {
    const response = await startAttemptPost(
      makeJsonRequest('http://localhost/api/tests/test-1/attempts/start', {}) as never,
      { params: Promise.resolve({ testId: 'test-1' }) },
    )

    assert.equal(response.status, 403)
    const payload = (await response.json()) as { error: string }
    assert.equal(payload.error, 'Not assigned to this event')
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/tests/[testId]/attempts/start blocks unassigned trial event access for null-event tests', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prisma.tournamentTest as Record<string, unknown>,
      'findFirst',
      async () =>
        ({
          tournament: { id: 'tour-1' },
          eventId: null,
          test: {
            id: 'test-2',
            clubId: 'club-1',
            status: 'PUBLISHED',
            testPasswordHash: null,
            maxAttempts: null,
            startAt: null,
            endAt: null,
            allowLateUntil: null,
            assignments: [],
          },
        }) as never,
    ),
    overrideMethod(
      prisma.membership as Record<string, unknown>,
      'findMany',
      async () =>
        [
          {
            id: 'membership-1',
            clubId: 'club-1',
            teamId: 'team-1',
            club: { id: 'club-1' },
            team: { id: 'team-1' },
          },
        ] as never,
    ),
    overrideMethod(
      prisma.tournamentRegistration as Record<string, unknown>,
      'findFirst',
      async () =>
        ({
          id: 'registration-1',
          clubId: 'club-1',
          teamId: 'team-1',
          trialEventSelections: [{ eventName: 'Robot Skills' }],
        }) as never,
    ),
    overrideMethod(
      prisma.testAudit as Record<string, unknown>,
      'findFirst',
      async () =>
        ({
          details: { eventName: 'Robot Skills' },
        }) as never,
    ),
    overrideMethod(
      prisma.tournamentMemberTrialEventAssignment as Record<string, unknown>,
      'findFirst',
      async () => null as never,
    ),
  ]

  try {
    const response = await startAttemptPost(
      makeJsonRequest('http://localhost/api/tests/test-2/attempts/start', {}) as never,
      { params: Promise.resolve({ testId: 'test-2' }) },
    )

    assert.equal(response.status, 403)
    const payload = (await response.json()) as { error: string }
    assert.equal(payload.error, 'Not assigned to this trial event')
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/tests/[testId]/attempts/[attemptId]/proctor-events records for owned in-progress regular attempts', async () => {
  const { prisma, serverSession } = await getDeps()
  let createdData: Record<string, unknown> | null = null

  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prisma.testAttempt as Record<string, unknown>,
      'findUnique',
      async () =>
        ({
          membershipId: 'membership-1',
          testId: 'test-regular-1',
          status: 'IN_PROGRESS',
        }) as never,
    ),
    overrideMethod(
      prisma.membership as Record<string, unknown>,
      'findFirst',
      async () => ({ id: 'membership-1' }) as never,
    ),
    overrideMethod(
      prisma.proctorEvent as Record<string, unknown>,
      'create',
      async (args: unknown) => {
        createdData = (args as { data: Record<string, unknown> }).data
        return {
          id: 'proctor-1',
          ...createdData,
        } as never
      },
    ),
  ]

  try {
    const response = await clubProctorEventPost(
      makeJsonRequest(
        'http://localhost/api/tests/test-regular-1/attempts/attempt-1/proctor-events',
        { kind: 'TAB_SWITCH', meta: { source: 'client' } },
      ) as never,
      { params: Promise.resolve({ testId: 'test-regular-1', attemptId: 'attempt-1' }) },
    )

    assert.equal(response.status, 201)
    assert.ok(createdData)
    const created = createdData as Record<string, unknown>
    assert.equal(created['attemptId'], 'attempt-1')
    assert.equal(created['esAttemptId'], undefined)
    assert.equal(created['kind'], 'TAB_SWITCH')
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/tests/[testId]/attempts/[attemptId]/proctor-events rejects test mismatch', async () => {
  const { prisma, serverSession } = await getDeps()

  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prisma.testAttempt as Record<string, unknown>,
      'findUnique',
      async () =>
        ({
          membershipId: 'membership-1',
          testId: 'different-test',
          status: 'IN_PROGRESS',
        }) as never,
    ),
  ]

  try {
    const response = await clubProctorEventPost(
      makeJsonRequest(
        'http://localhost/api/tests/test-regular-1/attempts/attempt-1/proctor-events',
        { kind: 'TAB_SWITCH' },
      ) as never,
      { params: Promise.resolve({ testId: 'test-regular-1', attemptId: 'attempt-1' }) },
    )

    assert.equal(response.status, 400)
    const payload = (await response.json()) as { error: string }
    assert.equal(payload.error, 'Attempt does not belong to this test')
  } finally {
    restoreAll(mocks)
  }
})

test('POST /api/es/tests/[testId]/attempts/[attemptId]/proctor-events records for owned in-progress ES attempts', async () => {
  const { prisma, serverSession } = await getDeps()
  let createdData: Record<string, unknown> | null = null

  const mocks = [
    overrideMethod(serverSession, 'get', async () => ({ user: { id: 'user-1' } }) as never),
    overrideMethod(
      prisma.eSTestAttempt as Record<string, unknown>,
      'findUnique',
      async () =>
        ({
          membershipId: 'membership-1',
          testId: 'es-test-1',
          status: 'IN_PROGRESS',
        }) as never,
    ),
    overrideMethod(
      prisma.membership as Record<string, unknown>,
      'findFirst',
      async () => ({ id: 'membership-1' }) as never,
    ),
    overrideMethod(
      prisma.proctorEvent as Record<string, unknown>,
      'create',
      async (args: unknown) => {
        createdData = (args as { data: Record<string, unknown> }).data
        return {
          id: 'proctor-es-1',
          ...createdData,
        } as never
      },
    ),
  ]

  try {
    const response = await esProctorEventPost(
      makeJsonRequest(
        'http://localhost/api/es/tests/es-test-1/attempts/es-attempt-1/proctor-events',
        { kind: 'EXIT_FULLSCREEN', meta: { source: 'client' } },
      ) as never,
      { params: Promise.resolve({ testId: 'es-test-1', attemptId: 'es-attempt-1' }) },
    )

    assert.equal(response.status, 201)
    assert.ok(createdData)
    const created = createdData as Record<string, unknown>
    assert.equal(created['esAttemptId'], 'es-attempt-1')
    assert.equal(created['attemptId'], undefined)
    assert.equal(created['kind'], 'EXIT_FULLSCREEN')
  } finally {
    restoreAll(mocks)
  }
})
