/**
 * Client-safe test availability checking functions
 * These functions don't use Node.js modules and can be imported in client components
 */

/**
 * Check if a test is currently available for taking
 * This is a client-safe version that can be used in React components
 * Accepts both Date objects and ISO date strings
 */
export function isTestAvailable(test: {
  status: string
  startAt: Date | null | string
  endAt: Date | null | string
  allowLateUntil: Date | null | string
}): { available: boolean; reason?: string } {
  if (test.status !== 'PUBLISHED') {
    return { available: false, reason: 'Test is not published' }
  }

  const now = new Date()

  // Handle string dates (from API) or Date objects
  const startAt = test.startAt 
    ? (typeof test.startAt === 'string' ? new Date(test.startAt) : test.startAt) 
    : null
  const endAt = test.endAt 
    ? (typeof test.endAt === 'string' ? new Date(test.endAt) : test.endAt) 
    : null
  const allowLateUntil = test.allowLateUntil 
    ? (typeof test.allowLateUntil === 'string' ? new Date(test.allowLateUntil) : test.allowLateUntil) 
    : null

  if (startAt && now < startAt) {
    return { available: false, reason: 'Test has not started yet' }
  }

  if (endAt) {
    const deadline = allowLateUntil || endAt
    if (now > deadline) {
      return { available: false, reason: 'Test deadline has passed' }
    }
  }

  return { available: true }
}
