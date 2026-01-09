import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NewTestBuilder } from '@/components/tests/new-test-builder'

export default async function NewTestPage({
  params,
}: {
  params: { clubId: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/login')
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_clubId: {
        userId: session.user.id,
        clubId: params.clubId,
      },
    },
    select: {
      id: true,
      role: true,
    },
  })

  if (!membership || String(membership.role) !== 'ADMIN') {
    redirect(`/club/${params.clubId}?tab=tests`)
  }

  const club = await prisma.club.findUnique({
    where: { id: params.clubId },
    select: {
      id: true,
      name: true,
      division: true,
      teams: {
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      },
    },
  })

  if (!club) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <div className="px-4 py-8 lg:px-8">
        <NewTestBuilder clubId={club.id} clubName={club.name} clubDivision={club.division} teams={club.teams} />
      </div>
    </div>
  )
}


