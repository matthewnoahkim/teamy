import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { HomeClient } from '@/components/home-client'

export default async function DashboardClubPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: {
      club: {
        select: {
          id: true,
          name: true,
          division: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      rosterAssignments: {
        include: {
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
              division: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return <HomeClient memberships={memberships} user={session.user} />
}

