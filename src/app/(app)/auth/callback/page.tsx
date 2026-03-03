import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPreferredClubPathForUser } from '@/lib/club-routing'
import { cookies } from 'next/headers'

async function getDefaultRedirect(userId: string) {
  const cookieStore = await cookies()
  const lastVisitedClub = cookieStore.get('lastVisitedClub')?.value

  return getPreferredClubPathForUser(userId, { lastVisitedClubId: lastVisitedClub })
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
