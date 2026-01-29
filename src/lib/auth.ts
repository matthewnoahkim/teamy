import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import type { Adapter } from 'next-auth/adapters'

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const providers = []
if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      allowDangerousEmailAccountLinking: true,
    })
  )
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('Google OAuth env vars are missing; auth providers are not configured.')
}

const prismaAdapter = process.env.DATABASE_URL ? (PrismaAdapter(prisma) as Adapter) : undefined

export const authOptions: NextAuthOptions = {
  adapter: prismaAdapter,
  providers,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Ensure user exists in database when signing in with JWT strategy
      if (user.email) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          })

          if (!existingUser && user.id) {
            // Create new user
            await prisma.user.create({
              data: {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              },
            })
          } else if (existingUser && account) {
            // Check if account is already linked
            const existingAccount = await prisma.account.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
            })

            // If account doesn't exist, create it and link to existing user
            if (!existingAccount) {
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
                  session_state: account.session_state,
                },
              })
            }

            // Update user ID in token if needed
            if (user.id !== existingUser.id) {
              user.id = existingUser.id
            }
          }
        } catch (error) {
          console.error('Sign in callback error:', error)
          return false
        }
      }
      return true
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        
        // Always fetch the latest user data from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        })
        
        if (dbUser) {
          session.user.name = dbUser.name
          session.user.email = dbUser.email
          session.user.image = dbUser.image
        }
      }
      return session
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
  pages: {
    signIn: '/login',
  },
}
