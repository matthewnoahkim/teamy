/**
 * Comprehensive Validation Schemas for API Endpoints
 * Uses Zod for runtime type checking and input sanitization
 * 
 * SECURITY PRINCIPLES:
 * 1. Validate all user input - never trust client data
 * 2. Sanitize strings to prevent injection attacks
 * 3. Enforce reasonable length limits to prevent DoS
 * 4. Use strict types - reject unexpected fields
 * 5. Provide clear error messages without exposing internals
 */

import { z } from 'zod'
import { sanitizeString, sanitizeSearchQuery } from './input-validation'

// ============================================================================
// COMMON VALIDATION HELPERS
// ============================================================================

/**
 * Email validation with sanitization
 * Rejects obviously malicious patterns while allowing valid emails
 */
export const emailSchema = z
  .string()
  .min(3, 'Email must be at least 3 characters')
  .max(255, 'Email must not exceed 255 characters')
  .email('Invalid email format')
  .transform((val) => sanitizeString(val.toLowerCase(), 255))

/**
 * Name validation (person, organization, etc.)
 * Allows most Unicode characters but limits length
 */
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(200, 'Name must not exceed 200 characters')
  .transform((val) => sanitizeString(val, 200))

/**
 * Phone number validation (optional, flexible format)
 * Accepts various international formats
 */
export const phoneSchema = z
  .string()
  .max(30, 'Phone number too long')
  .regex(
    /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}[-\s\.]?[0-9]{1,9}$/,
    'Invalid phone number format'
  )
  .optional()
  .transform((val) => (val ? sanitizeString(val, 30) : undefined))

/**
 * URL/slug validation for custom tournament URLs
 * Only allows safe characters: lowercase letters, numbers, hyphens
 */
export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(100, 'Slug must not exceed 100 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must only contain lowercase letters, numbers, and hyphens')
  .optional()

/**
 * Text content validation (messages, descriptions, etc.)
 * Allows multiline text with reasonable limits
 */
export const textContentSchema = (maxLength: number = 5000) =>
  z
    .string()
    .min(1, 'Content is required')
    .max(maxLength, `Content must not exceed ${maxLength} characters`)
    .transform((val) => sanitizeString(val, maxLength))

// ============================================================================
// PUBLIC ENDPOINT SCHEMAS
// ============================================================================

/**
 * Contact Form Schema
 * SECURITY: Public endpoint - strict validation required
 */
export const contactFormSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    subject: z
      .string()
      .min(1, 'Subject is required')
      .max(200, 'Subject must not exceed 200 characters')
      .transform((val) => sanitizeString(val, 200)),
    message: textContentSchema(5000),
  })
  .strict() // Reject any additional fields

/**
 * Demo Request Schema
 * SECURITY: Public endpoint - validates school name and email
 */
export const demoRequestSchema = z
  .object({
    email: emailSchema,
    schoolName: z
      .string()
      .min(1, 'School name is required')
      .max(300, 'School name must not exceed 300 characters')
      .transform((val) => sanitizeString(val, 300)),
  })
  .strict()

/**
 * Grant Application Schema
 * SECURITY: Public endpoint - extensive validation for financial data
 */
export const grantApplicationSchema = z
  .object({
    // Club Information
    clubName: z
      .string()
      .min(1, 'Club name is required')
      .max(200, 'Club name must not exceed 200 characters')
      .transform((val) => sanitizeString(val, 200)),
    schoolName: nameSchema,
    schoolAddress: z
      .string()
      .min(5, 'School address is required')
      .max(500, 'Address must not exceed 500 characters')
      .transform((val) => sanitizeString(val, 500)),
    clubDivision: z.enum(['B', 'C', 'B&C'], {
      message: 'Division must be B, C, or B&C',
    }),
    numberOfTeams: z
      .coerce
      .number()
      .int()
      .min(1, 'Must have at least 1 team')
      .max(100, 'Number of teams seems unrealistic'),
    yearsParticipating: z
      .coerce
      .number()
      .int()
      .min(0, 'Years cannot be negative')
      .max(100, 'Years in Science Olympiad seems unrealistic'),
    grantAmount: z
      .coerce
      .number()
      .int()
      .min(1, 'Grant amount must be at least $1')
      .max(100000, 'Grant amount exceeds maximum limit'),
    
    // Long-form answers
    clubDescription: textContentSchema(10000),
    grantBenefit: textContentSchema(10000),
    suggestions: z
      .string()
      .max(5000, 'Suggestions must not exceed 5000 characters')
      .transform((val) => sanitizeString(val, 5000))
      .optional(),
    
    // Contact Information
    contactRole: z.enum(['officer', 'coach'], {
      message: 'Contact role must be officer or coach',
    }),
    applicantName: nameSchema,
    applicantEmail: emailSchema,
    confirmEmail: emailSchema,
    coachName: z
      .string()
      .max(200, 'Coach name must not exceed 200 characters')
      .transform((val) => sanitizeString(val, 200))
      .optional(),
    coachEmail: emailSchema.optional(),
  })
  .strict()
  .refine((data) => data.applicantEmail === data.confirmEmail, {
    message: 'Email addresses do not match',
    path: ['confirmEmail'],
  })
  .refine(
    (data) => {
      // If officer/captain, coach info is required
      if (data.contactRole === 'officer') {
        return !!data.coachName && !!data.coachEmail
      }
      return true
    },
    {
      message: 'Coach information is required for officer/captain applications',
      path: ['coachName'],
    }
  )

/**
 * Tournament Hosting Request Schema
 * SECURITY: Public endpoint - validates tournament details and director info
 */
export const tournamentRequestSchema = z
  .object({
    tournamentName: z
      .string()
      .min(3, 'Tournament name must be at least 3 characters')
      .max(200, 'Tournament name must not exceed 200 characters')
      .transform((val) => sanitizeString(val, 200)),
    tournamentLevel: z.enum(['invitational', 'regional', 'state', 'national'], {
      message: 'Invalid tournament level',
    }),
    division: z.enum(['B', 'C', 'B&C'], {
      message: 'Division must be B, C, or B&C',
    }),
    tournamentFormat: z.enum(['in-person', 'satellite', 'mini-so'], {
      message: 'Invalid tournament format',
    }),
    location: z
      .string()
      .max(300, 'Location must not exceed 300 characters')
      .transform((val) => sanitizeString(val, 300))
      .optional()
      .nullable(),
    preferredSlug: slugSchema.nullable(),
    directorName: nameSchema,
    directorEmail: emailSchema,
    confirmEmail: emailSchema,
    directorPhone: phoneSchema.nullable(),
    otherNotes: z
      .string()
      .max(2000, 'Notes must not exceed 2000 characters')
      .transform((val) => sanitizeString(val, 2000))
      .optional()
      .nullable(),
  })
  .strict()
  .refine((data) => data.directorEmail === data.confirmEmail, {
    message: 'Email addresses do not match',
    path: ['confirmEmail'],
  })
  .refine(
    (data) => {
      // If in-person, location is required
      if (data.tournamentFormat === 'in-person') {
        return !!data.location && data.location.trim().length > 0
      }
      return true
    },
    {
      message: 'Location is required for in-person tournaments',
      path: ['location'],
    }
  )

// ============================================================================
// SEARCH AND QUERY SCHEMAS
// ============================================================================

/**
 * Search query validation
 * SECURITY: Prevent injection through search parameters
 */
export const searchQuerySchema = z
  .string()
  .max(200, 'Search query too long')
  .transform((val) => sanitizeSearchQuery(val))
  .optional()

/**
 * Pagination parameters
 * SECURITY: Prevent resource exhaustion through excessive page sizes
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

/**
 * Sort parameters
 * SECURITY: Only allow sorting by whitelisted fields
 */
export const createSortSchema = (allowedFields: readonly string[]) =>
  z.object({
    sortBy: z.enum(allowedFields as [string, ...string[]]).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Validate request body and return typed data or error response data
 * 
 * @example
 * const result = validateRequestBody(body, contactFormSchema)
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 })
 * }
 * const data = result.data
 */
export function validateRequestBody<T extends z.ZodType>(
  body: unknown,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string; details?: any } {
  try {
    const result = schema.safeParse(body)
    
    if (result.success) {
      return { success: true, data: result.data }
    }
    
    // Format Zod errors into user-friendly messages
    const errors = result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }))
    
    return {
      success: false,
      error: 'Validation failed',
      details: errors,
    }
  } catch (error) {
    // Catch any unexpected errors during validation
    return {
      success: false,
      error: 'Invalid request data',
    }
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T extends z.ZodType>(
  params: Record<string, string | string[] | undefined>,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string; details?: any } {
  return validateRequestBody(params, schema)
}

/**
 * Create a standardized error response for validation failures
 */
export function createValidationErrorResponse(error: string, details?: any) {
  return {
    error,
    message: 'Invalid input data. Please check your request and try again.',
    ...(details && { details }),
  }
}
