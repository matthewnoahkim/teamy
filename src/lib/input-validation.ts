import { z } from 'zod'

/**
 * Input validation and sanitization utilities to prevent SQL injection and other attacks
 */

/**
 * Sanitize string input to prevent injection attacks
 * Removes or escapes potentially dangerous characters
 */
export function sanitizeString(input: string | null | undefined, maxLength = 500): string {
  if (!input) return ''
  
  // Trim whitespace
  let sanitized = input.trim()
  
  // Limit length to prevent DoS
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  
  // Remove null bytes (common in injection attacks)
  sanitized = sanitized.replace(/\0/g, '')
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
  
  return sanitized
}

/**
 * Sanitize search query input (more permissive than general string sanitization)
 */
export function sanitizeSearchQuery(input: string | null | undefined, maxLength = 200): string {
  if (!input) return ''
  
  let sanitized = input.trim()
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
  
  return sanitized
}

/**
 * Validate and sanitize ID (UUID or CUID format)
 */
export function validateId(id: string | null | undefined): string | null {
  if (!id) return null
  
  // CUID format: starts with 'c', 25 characters
  // UUID format: 8-4-4-4-12 hex characters
  const cuidPattern = /^c[0-9a-z]{24}$/i
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  const sanitized = id.trim()
  
  if (cuidPattern.test(sanitized) || uuidPattern.test(sanitized)) {
    return sanitized
  }
  
  // If it doesn't match expected formats, reject it
  return null
}

/**
 * Validate and parse integer with bounds
 */
export function validateInteger(
  input: string | null | undefined,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  defaultValue?: number
): number | null {
  if (!input) {
    return defaultValue ?? null
  }
  
  const parsed = parseInt(input, 10)
  
  // Check if parsing was successful and is a valid number
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue ?? null
  }
  
  // Check bounds
  if (parsed < min || parsed > max) {
    return defaultValue ?? null
  }
  
  return parsed
}

/**
 * Validate and parse date string
 */
export function validateDate(input: string | null | undefined): Date | null {
  if (!input) return null
  
  const date = new Date(input)
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return null
  }
  
  return date
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  input: string | null | undefined,
  allowedValues: readonly T[],
  defaultValue?: T
): T | null {
  if (!input) {
    return defaultValue ?? null
  }
  
  const sanitized = input.trim()
  
  if (allowedValues.includes(sanitized as T)) {
    return sanitized as T
  }
  
  return defaultValue ?? null
}

/**
 * Validate boolean from string
 */
export function validateBoolean(input: string | null | undefined): boolean | null {
  if (!input) return null
  
  const lower = input.toLowerCase().trim()
  
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true
  }
  
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false
  }
  
  return null
}

/**
 * Zod schemas for common validations
 */
export const idSchema = z.string().regex(/^(c[0-9a-z]{24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)

export const searchQuerySchema = z.string().max(200).transform((val) => sanitizeSearchQuery(val))

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

/**
 * Safe Prisma where clause builder
 * Ensures all user input is properly sanitized
 */
export function buildSafeWhereClause<T extends Record<string, any>>(input: {
  search?: string | null
  id?: string | null
  userId?: string | null
  [key: string]: any
}): Partial<T> {
  const where: Partial<T> = {}
  
  if (input.search) {
    const sanitized = sanitizeSearchQuery(input.search)
    if (sanitized) {
      // Note: Prisma's contains is safe - it uses parameterized queries
      // But we still sanitize to prevent DoS through very long strings
      ;(where as any).name = { contains: sanitized, mode: 'insensitive' }
    }
  }
  
  if (input.id) {
    const validated = validateId(input.id)
    if (validated) {
      ;(where as any).id = validated
    }
  }
  
  if (input.userId) {
    const validated = validateId(input.userId)
    if (validated) {
      ;(where as any).userId = validated
    }
  }
  
  return where
}

/**
 * Validate Prisma orderBy input to prevent injection
 */
export function validateOrderBy(
  field: string | null | undefined,
  allowedFields: readonly string[],
  direction: 'asc' | 'desc' = 'asc'
): Record<string, 'asc' | 'desc'> | null {
  if (!field) return null
  
  const sanitized = field.trim()
  
  if (allowedFields.includes(sanitized)) {
    return { [sanitized]: direction }
  }
  
  return null
}
