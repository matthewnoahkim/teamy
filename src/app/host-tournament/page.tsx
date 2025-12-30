import { PublicPageLayout } from '@/components/public-page-layout'
import { HostTournamentContent } from '@/components/host-tournament-content'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function HostTournamentPage() {
  const session = await getServerSession(authOptions)
  const isAuthenticated = !!session?.user

  return (
    <PublicPageLayout>
      <HostTournamentContent isAuthenticated={isAuthenticated} />
    </PublicPageLayout>
  )
}
