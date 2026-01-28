import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

async function getDefaultRedirect(userId: string) {
  // Check if user has any club memberships
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { club: true },
    orderBy: { createdAt: 'desc' }
  })

  if (memberships.length === 0) {
    return '/no-clubs'
  }

  // Check for last visited club cookie
  const cookieStore = await cookies()
  const lastVisitedClub = cookieStore.get('lastVisitedClub')?.value

  if (lastVisitedClub) {
    // Verify the user is still a member of this club
    const isMember = memberships.some(m => m.club.id === lastVisitedClub)
    if (isMember) {
      return `/club/${lastVisitedClub}`
    }
  }

  // Default to first club
  return `/club/${memberships[0].club.id}`
}

export default async function AuthCallbackPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    // Not logged in, redirect to login
    redirect('/login')
  }

  // Get the smart redirect destination
  const destination = await getDefaultRedirect(session.user.id)
  redirect(destination)
}
