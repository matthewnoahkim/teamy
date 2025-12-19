import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TestingPortalClient } from '@/components/testing-portal-client'
import { TestingLoginClient } from '@/components/testing-login-client'
import { prisma } from '@/lib/prisma'

export default async function TestingPage() {
  const session = await getServerSession(authOptions)

  // If not signed in, show login page
  if (!session?.user?.email) {
    return <TestingLoginClient />
  }

  // Check if the user has any tournament registrations
  const memberships = await prisma.membership.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      team: {
        select: {
          id: true,
        },
      },
    },
  })

  const teamIds = memberships
    .map((m) => m.teamId)
    .filter((id): id is string => id !== null)
  const clubIds = memberships.map((m) => m.clubId)

  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      OR: [
        { teamId: { in: teamIds } },
        { clubId: { in: clubIds } },
      ],
      status: 'CONFIRMED',
    },
    take: 1, // Just check if any exist
  })

  // If no registrations found, show unauthorized message
  if (registrations.length === 0) {
    return <TestingLoginClient unauthorized email={session.user.email} />
  }

  return <TestingPortalClient user={session.user} />
}

