import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NoClubsClient } from '@/components/no-clubs-client'

type NoClubsPageProps = {
  searchParams?: {
    code?: string
  }
}

export default async function NoClubsPage({ searchParams }: NoClubsPageProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const code = searchParams?.code?.toString() ?? ''

  return <NoClubsClient user={session.user} initialCode={code} />
}
