import test from 'node:test'
import assert from 'node:assert/strict'
import { Role, TestAssignmentScope } from '@prisma/client'
import {
  getAudienceRolesForMembership,
  hasAnnouncementTargetAccess,
  hasTestAssignmentAccess,
  type MembershipAuthzContext,
  type TestAssignmentTarget,
} from '@/lib/club-authz'

const baseMember: MembershipAuthzContext = {
  id: 'm1',
  teamId: 't1',
  role: Role.MEMBER,
  roles: [],
}

const baseAdmin: MembershipAuthzContext = {
  id: 'a1',
  teamId: null,
  role: Role.ADMIN,
  roles: ['CAPTAIN'],
}

test('getAudienceRolesForMembership maps default role and normalizes custom roles', () => {
  assert.deepEqual(getAudienceRolesForMembership(baseMember), ['MEMBER'])
  assert.deepEqual(getAudienceRolesForMembership(baseAdmin), ['COACH', 'CAPTAIN'])
  assert.deepEqual(
    getAudienceRolesForMembership({
      ...baseMember,
      roles: ['captain', ' CAPTAIN ', 'coach'],
    }),
    ['MEMBER', 'CAPTAIN', 'COACH'],
  )
})

test('hasAnnouncementTargetAccess enforces target filters when present', () => {
  assert.equal(hasAnnouncementTargetAccess([], baseMember, []), true)
  assert.equal(
    hasAnnouncementTargetAccess([{ targetRole: 'CAPTAIN', eventId: null }], baseMember, []),
    false,
  )
  assert.equal(
    hasAnnouncementTargetAccess([{ targetRole: 'CAPTAIN', eventId: null }], { ...baseMember, roles: ['CAPTAIN'] }, []),
    true,
  )
  assert.equal(
    hasAnnouncementTargetAccess([{ targetRole: null, eventId: 'ev1' }], baseMember, ['ev1']),
    true,
  )
  assert.equal(
    hasAnnouncementTargetAccess([{ targetRole: null, eventId: 'ev2' }], baseMember, ['ev1']),
    false,
  )
  assert.equal(
    hasAnnouncementTargetAccess(
      [
        { targetRole: 'CAPTAIN', eventId: null },
        { targetRole: null, eventId: 'ev9' },
      ],
      baseAdmin,
      [],
    ),
    true,
  )
})

test('hasTestAssignmentAccess enforces club/team/personal/event scopes', () => {
  const assignments: TestAssignmentTarget[] = [
    {
      assignedScope: TestAssignmentScope.CLUB,
      teamId: null,
      targetMembershipId: null,
      eventId: null,
    },
  ]
  assert.equal(hasTestAssignmentAccess(assignments, baseMember, []), true)

  assert.equal(
    hasTestAssignmentAccess(
      [
        {
          assignedScope: TestAssignmentScope.TEAM,
          teamId: 't1',
          targetMembershipId: null,
          eventId: null,
        },
      ],
      baseMember,
      [],
    ),
    true,
  )
  assert.equal(
    hasTestAssignmentAccess(
      [
        {
          assignedScope: TestAssignmentScope.TEAM,
          teamId: 'other',
          targetMembershipId: null,
          eventId: null,
        },
      ],
      baseMember,
      [],
    ),
    false,
  )

  assert.equal(
    hasTestAssignmentAccess(
      [
        {
          assignedScope: TestAssignmentScope.PERSONAL,
          teamId: null,
          targetMembershipId: 'm1',
          eventId: null,
        },
      ],
      baseMember,
      [],
    ),
    true,
  )
  assert.equal(
    hasTestAssignmentAccess(
      [
        {
          assignedScope: TestAssignmentScope.PERSONAL,
          teamId: null,
          targetMembershipId: 'someone-else',
          eventId: null,
        },
      ],
      baseMember,
      [],
    ),
    false,
  )

  assert.equal(
    hasTestAssignmentAccess(
      [
        {
          assignedScope: TestAssignmentScope.PERSONAL,
          teamId: null,
          targetMembershipId: null,
          eventId: 'ev1',
        },
      ],
      baseMember,
      ['ev1'],
    ),
    true,
  )
  assert.equal(
    hasTestAssignmentAccess([], baseMember, ['ev1']),
    false,
  )
})
