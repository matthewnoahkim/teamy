import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import type { Adapter } from 'next-auth/adapters'

// ============================================================================
// NEXTAUTH_SECRET VALIDATION
// ============================================================================
// Fail fast if the secret is missing or still a known placeholder.
// A weak/missing secret means JWTs can be forged → full account takeover.
// Skip during next build (npm_lifecycle_event === 'build') so static analysis
// and page data collection succeed; validation still runs at runtime.
const KNOWN_WEAK_SECRETS = [
  'quick-preview-secret-replace-this-in-production',
  'change-me',
  'secret',
  'development-secret',
]

const isBuildPhase = process.env.npm_lifecycle_event === 'build'
if (
  process.env.NODE_ENV === 'production' &&
  !isBuildPhase
) {
  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error(
      'CRITICAL: NEXTAUTH_SECRET is not set. The application cannot start without a secure secret in production.'
    )
  }
  if (KNOWN_WEAK_SECRETS.includes(process.env.NEXTAUTH_SECRET)) {
    throw new Error(
      'CRITICAL: NEXTAUTH_SECRET is set to a known placeholder value. Generate a secure random secret: `openssl rand -base64 48`'
    )
  }
  if (process.env.NEXTAUTH_SECRET.length < 32) {
    throw new Error(
      'CRITICAL: NEXTAUTH_SECRET is too short. It must be at least 32 characters. Generate one: `openssl rand -base64 48`'
    )
  }
}

// ============================================================================
// PROVIDERS
// ============================================================================
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const providers = []
if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      // Request the profile scope so we can check email_verified
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  )
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('Google OAuth env vars are missing; auth providers are not configured.')
}

// ============================================================================
// ADAPTER
// ============================================================================
const prismaAdapter = process.env.DATABASE_URL ? (PrismaAdapter(prisma) as Adapter) : undefined

// ============================================================================
// AUTH OPTIONS
// ============================================================================
export const authOptions: NextAuthOptions = {
  adapter: prismaAdapter,
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    // Session expires after 7 days (default is 30 days — shorter is more secure)
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    // Refresh the session token every 24 hours
    updateAge: 24 * 60 * 60, // 24 hours in seconds
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Ensure user has an email — reject sign-in without one
      if (!user.email) {
        console.warn('Sign-in rejected: no email provided')
        return false
      }

      // Verify the email is confirmed by the OAuth provider.
      // Google includes `email_verified` in the profile. If it's explicitly
      // false, reject sign-in to prevent account linking with unverified emails.
      const googleProfile = profile as { email_verified?: boolean } | undefined
      if (googleProfile && googleProfile.email_verified === false) {
        console.warn('Sign-in rejected: email not verified by provider')
        return false
      }

      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        })

        if (!existingUser && user.id) {
          // ── New user: create record ──
          await prisma.user.create({
            data: {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
            },
          })
        } else if (existingUser && account) {
          // ── Returning user: link OAuth account if not already linked ──
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
          })

          if (!existingAccount) {
            // Verify this provider account isn't already linked to a *different* user
            const otherLinkedAccount = await prisma.account.findFirst({
              where: {
                provider: account.provider,
                userId: { not: existingUser.id },
                // Check if any account from this provider is linked to the email
              },
            })

            if (otherLinkedAccount) {
              console.warn(
                `Sign-in: OAuth account already linked to a different user. ` +
                `Provider: ${account.provider}, existing userId: ${otherLinkedAccount.userId}`
              )
              // Still allow sign-in — they'll be linked to the correct user by email
            }

            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
            })
          }

          // Ensure the token uses the correct database user ID
          if (user.id !== existingUser.id) {
            user.id = existingUser.id
          }
        }
      } catch (error) {
        // Log only the error type, not the full object (may contain PII)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('Sign in callback error:', errMsg)
        return false
      }

      return true
    },

    async jwt({ token, user, trigger }) {
      // On initial sign-in, set the user ID
      if (user) {
        token.sub = user.id
      }

      // Refresh user data periodically (every 5 minutes) instead of on every request.
      // This is stored in the JWT so the session callback doesn't need a DB query every time.
      const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes in ms
      const now = Date.now()
      const lastRefresh = (token.userDataRefreshedAt as number) || 0

      if (trigger === 'update' || now - lastRefresh > REFRESH_INTERVAL) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          })

          if (dbUser) {
            token.name = dbUser.name
            token.email = dbUser.email
            token.picture = dbUser.image
            token.userDataRefreshedAt = now
          }
        } catch {
          // If DB is unavailable, use cached data — don't break auth
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        // Populate session from the JWT token (no DB query needed)
        session.user.id = token.sub
        if (token.name) session.user.name = token.name as string
        if (token.email) session.user.email = token.email as string
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login', // Redirect auth errors to login page instead of default error page
  },
}
