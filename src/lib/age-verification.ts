type PreferencesRecord = Record<string, unknown>

const AGE_VERIFICATION_KEY = 'ageVerification'
const MAX_AGE_YEARS = 120

function getPreferencesObject(preferences: unknown): PreferencesRecord {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return {}
  }
  return preferences as PreferencesRecord
}

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed)) return parsed
  }
  return null
}

export function getBirthYearBounds(referenceDate: Date = new Date()): {
  minBirthYear: number
  maxBirthYear: number
} {
  const maxBirthYear = referenceDate.getUTCFullYear()
  return {
    minBirthYear: maxBirthYear - MAX_AGE_YEARS,
    maxBirthYear,
  }
}

export function isValidBirthMonth(birthMonth: number): boolean {
  return Number.isInteger(birthMonth) && birthMonth >= 1 && birthMonth <= 12
}

export function isValidBirthYear(birthYear: number, referenceDate: Date = new Date()): boolean {
  const { minBirthYear, maxBirthYear } = getBirthYearBounds(referenceDate)
  return Number.isInteger(birthYear) && birthYear >= minBirthYear && birthYear <= maxBirthYear
}

export function parseBirthMonth(value: unknown): number | null {
  const parsed = parseInteger(value)
  if (parsed === null || !isValidBirthMonth(parsed)) return null
  return parsed
}

export function parseBirthYear(value: unknown, referenceDate: Date = new Date()): number | null {
  const parsed = parseInteger(value)
  if (parsed === null || !isValidBirthYear(parsed, referenceDate)) return null
  return parsed
}

export function parseBirthMonthYear(
  birthMonthValue: unknown,
  birthYearValue: unknown,
  referenceDate: Date = new Date()
): { birthMonth: number; birthYear: number } | null {
  const birthMonth = parseBirthMonth(birthMonthValue)
  const birthYear = parseBirthYear(birthYearValue, referenceDate)

  if (!birthMonth || !birthYear) return null

  return { birthMonth, birthYear }
}

export function isUnder13ForBirthDate(
  birthMonth: number,
  birthYear: number,
  referenceDate: Date = new Date()
): boolean {
  let age = referenceDate.getUTCFullYear() - birthYear
  const currentMonth = referenceDate.getUTCMonth() + 1
  if (currentMonth < birthMonth) {
    age -= 1
  }
  return age < 13
}

export function getAgeVerificationFromPreferences(preferences: unknown): {
  birthMonth: number
  birthYear: number
  verifiedAt: string
  parentConsent: boolean
} | null {
  const prefs = getPreferencesObject(preferences)
  const ageVerificationRaw = prefs[AGE_VERIFICATION_KEY]

  if (!ageVerificationRaw || typeof ageVerificationRaw !== 'object' || Array.isArray(ageVerificationRaw)) {
    return null
  }

  const ageVerification = ageVerificationRaw as Record<string, unknown>
  const parsed = parseBirthMonthYear(ageVerification.birthMonth, ageVerification.birthYear)

  if (!parsed) return null

  const verifiedAt = typeof ageVerification.verifiedAt === 'string'
    ? ageVerification.verifiedAt
    : ''

  if (!verifiedAt) return null

  const parsedDate = new Date(verifiedAt)
  if (Number.isNaN(parsedDate.getTime())) return null

  const parentConsent = ageVerification.parentConsent === true

  return {
    birthMonth: parsed.birthMonth,
    birthYear: parsed.birthYear,
    verifiedAt,
    parentConsent,
  }
}

export function hasAgeVerification(preferences: unknown): boolean {
  const ageVerification = getAgeVerificationFromPreferences(preferences)
  if (!ageVerification) return false

  if (isUnder13ForBirthDate(ageVerification.birthMonth, ageVerification.birthYear)) {
    return ageVerification.parentConsent
  }

  return true
}

export function withAgeVerification(
  preferences: unknown,
  params: { birthMonth: number; birthYear: number; parentConsent: boolean; verifiedAt?: Date }
): PreferencesRecord {
  const currentPreferences = getPreferencesObject(preferences)
  const verifiedAt = (params.verifiedAt ?? new Date()).toISOString()

  return {
    ...currentPreferences,
    [AGE_VERIFICATION_KEY]: {
      birthMonth: params.birthMonth,
      birthYear: params.birthYear,
      parentConsent: params.parentConsent,
      verifiedAt,
    },
  }
}

export function getYearOptions(referenceDate: Date = new Date()): number[] {
  const { minBirthYear, maxBirthYear } = getBirthYearBounds(referenceDate)
  const years: number[] = []

  for (let year = maxBirthYear; year >= minBirthYear; year -= 1) {
    years.push(year)
  }

  return years
}
