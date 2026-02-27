import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PEOPLE_ACTIVITY_ACTIONS,
  shouldCountPeopleActivityAsUnread,
} from '@/lib/people-notifications'

test('PEOPLE_ACTIVITY_ACTIONS includes core membership actions', () => {
  assert.equal(PEOPLE_ACTIVITY_ACTIONS.includes('USER_JOINED_CLUB'), true)
  assert.equal(PEOPLE_ACTIVITY_ACTIONS.includes('MEMBERSHIP_LEFT_CLUB'), true)
  assert.equal(PEOPLE_ACTIVITY_ACTIONS.includes('MEMBERSHIP_REMOVED'), true)
  assert.equal(PEOPLE_ACTIVITY_ACTIONS.includes('MEMBERSHIP_ROLE_CHANGED'), true)
})

test('shouldCountPeopleActivityAsUnread excludes self-actor entries', () => {
  assert.equal(
    shouldCountPeopleActivityAsUnread({
      action: 'USER_JOINED_CLUB',
      clubId: 'club-1',
      viewerUserId: 'user-1',
      actorUserId: 'user-1',
      metadata: { clubId: 'club-1' },
    }),
    false,
  )
})

test('shouldCountPeopleActivityAsUnread allows observer entries in same club', () => {
  assert.equal(
    shouldCountPeopleActivityAsUnread({
      action: 'USER_JOINED_CLUB',
      clubId: 'club-1',
      viewerUserId: 'viewer-1',
      actorUserId: 'user-2',
      metadata: { clubId: 'club-1' },
    }),
    true,
  )
})

test('shouldCountPeopleActivityAsUnread rejects unknown actions and wrong club metadata', () => {
  assert.equal(
    shouldCountPeopleActivityAsUnread({
      action: 'UNKNOWN_ACTION',
      clubId: 'club-1',
      viewerUserId: 'viewer-1',
      actorUserId: 'user-2',
      metadata: { clubId: 'club-1' },
    }),
    false,
  )

  assert.equal(
    shouldCountPeopleActivityAsUnread({
      action: 'MEMBERSHIP_ROLE_CHANGED',
      clubId: 'club-1',
      viewerUserId: 'viewer-1',
      actorUserId: 'user-2',
      metadata: { clubId: 'club-2' },
    }),
    false,
  )
})
