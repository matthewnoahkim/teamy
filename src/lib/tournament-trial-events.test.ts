import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseTournamentTrialEvents,
  serializeTournamentTrialEvents,
  upsertTournamentTrialEvent,
} from '@/lib/tournament-trial-events'

test('parseTournamentTrialEvents normalizes legacy and object formats', () => {
  const parsed = parseTournamentTrialEvents(
    JSON.stringify([
      'Robot Skills',
      { name: 'Forensics Trial', division: 'B' },
      { name: 'Robot Skills', division: 'C' },
      { name: '  Experimental Design  ' },
      { bad: 'ignored' },
      '',
    ]),
    'C',
  )

  assert.deepEqual(parsed, [
    { name: 'Robot Skills', division: 'C' },
    { name: 'Forensics Trial', division: 'B' },
    { name: 'Experimental Design', division: 'C' },
  ])
})

test('upsertTournamentTrialEvent appends new trial events without duplicating existing ones', () => {
  const initial = serializeTournamentTrialEvents([
    { name: 'Robot Skills', division: 'C' },
  ])

  const withNewEvent = upsertTournamentTrialEvent(
    initial,
    { name: 'Forensics Trial', division: 'C' },
    'C',
  )

  assert.deepEqual(parseTournamentTrialEvents(withNewEvent, 'C'), [
    { name: 'Robot Skills', division: 'C' },
    { name: 'Forensics Trial', division: 'C' },
  ])

  const deduped = upsertTournamentTrialEvent(
    withNewEvent,
    { name: 'robot skills', division: 'C' },
    'C',
  )

  assert.deepEqual(parseTournamentTrialEvents(deduped, 'C'), [
    { name: 'Robot Skills', division: 'C' },
    { name: 'Forensics Trial', division: 'C' },
  ])
})
