export type TournamentTrialEventDivision = 'B' | 'C'

export type TournamentTrialEvent = {
  name: string
  division: TournamentTrialEventDivision
}

function normalizeFallbackDivision(
  fallbackDivision: string | null | undefined
): TournamentTrialEventDivision {
  return fallbackDivision === 'B' ? 'B' : 'C'
}

export function parseTournamentTrialEvents(
  raw: string | null | undefined,
  fallbackDivision: string | null | undefined
): TournamentTrialEvent[] {
  if (!raw || !raw.trim()) {
    return []
  }

  const normalizedFallbackDivision = normalizeFallbackDivision(fallbackDivision)

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    const seen = new Set<string>()
    const normalized: TournamentTrialEvent[] = []

    for (const item of parsed) {
      if (typeof item === 'string') {
        const name = item.trim()
        if (!name) {
          continue
        }

        const key = `${name.toLowerCase()}::${normalizedFallbackDivision}`
        if (seen.has(key)) {
          continue
        }

        seen.add(key)
        normalized.push({ name, division: normalizedFallbackDivision })
        continue
      }

      if (!item || typeof item !== 'object' || !('name' in item)) {
        continue
      }

      const name = String(item.name ?? '').trim()
      if (!name) {
        continue
      }

      const rawDivision = 'division' in item ? String(item.division ?? '') : ''
      const division =
        rawDivision === 'B' || rawDivision === 'C'
          ? rawDivision
          : normalizedFallbackDivision

      const key = `${name.toLowerCase()}::${division}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      normalized.push({ name, division })
    }

    return normalized
  } catch {
    return []
  }
}

export function serializeTournamentTrialEvents(
  trialEvents: TournamentTrialEvent[]
): string | null {
  return trialEvents.length > 0 ? JSON.stringify(trialEvents) : null
}

export function upsertTournamentTrialEvent(
  raw: string | null | undefined,
  trialEvent: { name: string; division?: TournamentTrialEventDivision | null },
  fallbackDivision: string | null | undefined
): string | null {
  const name = trialEvent.name.trim()
  if (!name) {
    return serializeTournamentTrialEvents(
      parseTournamentTrialEvents(raw, fallbackDivision)
    )
  }

  const division =
    trialEvent.division === 'B' || trialEvent.division === 'C'
      ? trialEvent.division
      : normalizeFallbackDivision(fallbackDivision)

  const existing = parseTournamentTrialEvents(raw, fallbackDivision)
  const alreadyExists = existing.some(
    (event) => event.division === division && event.name.toLowerCase() === name.toLowerCase()
  )

  if (alreadyExists) {
    return serializeTournamentTrialEvents(existing)
  }

  return serializeTournamentTrialEvents([...existing, { name, division }])
}
