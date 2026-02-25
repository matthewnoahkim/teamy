/**
 * Security Configuration
 * Centralized management of API keys, webhooks, and security settings
 * 
 * SECURITY BEST PRACTICES:
 * 1. All secrets MUST be stored in environment variables
 * 2. Never commit actual secrets to version control
 * 3. Rotate keys regularly (at least quarterly)
 * 4. Use different keys for different environments (dev/staging/prod)
 * 5. Implement least privilege - only grant minimum necessary permissions
 */

// ============================================================================
// DISCORD WEBHOOK URLs
// ============================================================================
// Discord webhooks for various notification channels
// These should be separate webhooks for security and organizational purposes

export const DISCORD_WEBHOOKS = {
  /**
   * Contact form submissions webhook
   * SECURITY: Ensure this webhook only has permissions to post to the contact channel
   */
  CONTACT: process.env.CONTACT_DISCORD_WEBHOOK_URL || '',
  
  /**
   * Demo request webhook
   * SECURITY: Separate from contact to allow independent access control
   */
  DEMO: process.env.DEMO_DISCORD_WEBHOOK_URL || '',
  
  /**
   * Grant applications webhook
   * SECURITY: High sensitivity - contains financial information
   */
  GRANTS: process.env.GRANTS_DISCORD_WEBHOOK_URL || '',
  
  /**
   * Tournament hosting requests webhook
   * SECURITY: Contains director contact information
   */
  TOURNAMENT_REQUEST: process.env.TOURNAMENT_REQUEST_DISCORD_WEBHOOK_URL || '',
} as const

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================

export const EMAIL_CONFIG = {
  /**
   * Resend API key for transactional emails
   * SECURITY: This key has broad permissions - protect carefully
   */
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  
  /**
   * From email address for system emails
   */
  FROM_EMAIL: 'Teamy <no-reply@teamy.site>',
} as const

// ============================================================================
// API KEYS
// ============================================================================

export const API_KEYS = {
  /**
   * OpenAI API key for AI-powered features
   * SECURITY: High value key - rotate regularly, monitor usage
   */
  OPENAI: process.env.OPENAI_API_KEY || '',
  
  /**
   * Stripe secret key for payment processing
   * SECURITY: CRITICAL - Never expose client-side
   */
  STRIPE_SECRET: process.env.STRIPE_SECRET_KEY || '',
  
  /**
   * Stripe publishable key (safe for client-side)
   */
  STRIPE_PUBLISHABLE: process.env.STRIPE_PUBLISHABLE_KEY || '',
  
  /**
   * Stripe webhook signing secret
   * SECURITY: Used to verify webhook authenticity
   */
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
} as const

// ============================================================================
// SECURITY VALIDATION
// ============================================================================

/**
 * Validate that required environment variables are set
 * Call this at application startup to fail fast if configuration is missing
 */
export function validateSecurityConfig(): {
  valid: boolean
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []
  
  // Critical keys that must be present
  const criticalKeys = {
    'DATABASE_URL': process.env.DATABASE_URL,
    'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET,
  }
  
  // Important keys that should be present for full functionality
  const importantKeys = {
    'RESEND_API_KEY': EMAIL_CONFIG.RESEND_API_KEY,
    'CONTACT_DISCORD_WEBHOOK_URL': DISCORD_WEBHOOKS.CONTACT,
  }
  
  // Check critical keys
  for (const [key, value] of Object.entries(criticalKeys)) {
    if (!value) {
      missing.push(key)
    }
  }
  
  // Check important keys
  for (const [key, value] of Object.entries(importantKeys)) {
    if (!value) {
      warnings.push(`${key} is not set - some features may not work`)
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

// ============================================================================
// WEBHOOK VALIDATION
// ============================================================================

/**
 * Validate that a webhook URL is properly formatted
 * Helps catch configuration errors early
 */
export function isValidWebhookUrl(url: string): boolean {
  if (!url) return false
  
  try {
    const parsed = new URL(url)
    // Discord webhooks should be HTTPS
    if (parsed.protocol !== 'https:') return false
    // Should be a Discord domain
    if (!parsed.hostname.includes('discord.com')) return false
    return true
  } catch {
    return false
  }
}

/**
 * Get a webhook URL with validation
 * Returns null if webhook is not configured or invalid
 */
export function getValidatedWebhook(webhookKey: keyof typeof DISCORD_WEBHOOKS): string | null {
  const url = DISCORD_WEBHOOKS[webhookKey]
  return isValidWebhookUrl(url) ? url : null
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Security headers following OWASP best practices
 * Apply these to all responses for defense in depth
 */
export const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection (for older browsers)
  'X-XSS-Protection': '1; mode=block',
  
  // Control framing to prevent clickjacking
  'X-Frame-Options': 'SAMEORIGIN',
  
  // Referrer policy - balance privacy and functionality
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy - restrict dangerous features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  
  // Content Security Policy - gradually tighten as needed
  // Keep inline scripts for theme/bootstrap logic, but disallow eval.
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: https://api.stripe.com https://vitals.vercel-insights.com https://vitals.vercel-analytics.com",
    "frame-src 'self' https://js.stripe.com",
  ].join('; '),
} as const

/**
 * Get security headers as a plain object
 * Suitable for Next.js middleware or API routes
 */
export function getSecurityHeaders(): Record<string, string> {
  return { ...SECURITY_HEADERS }
}
