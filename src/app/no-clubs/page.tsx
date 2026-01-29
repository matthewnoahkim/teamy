import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NoClubsClient } from '@/components/no-clubs-client'

type NoClubsPageProps = {
  searchParams?: Promise<{
    code?: string
  }>
}

export default async function NoClubsPage({ searchParams }: NoClubsPageProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const resolvedSearchParams = await searchParams
  const code = resolvedSearchParams?.code?.toString() ?? ''

  return <NoClubsClient user={session.user} initialCode={code} />
}
