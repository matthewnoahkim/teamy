import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PublicPageLayout } from '@/components/public-page-layout'
import { HostingTournamentsPage } from '@/components/hosting-tournaments-page'

export default async function TournamentsPage() {
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session?.user

  return (
    <PublicPageLayout>
      <HostingTournamentsPage isLoggedIn={isLoggedIn} />
    </PublicPageLayout>
  )
}
