import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { DashboardTournamentsClient } from '@/components/dashboard-tournaments-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Tournament Listings | Teamy',
  description: 'Browse approved Science Olympiad tournaments and invitational competitions.',
}

export default async function TournamentListingsPage() {
  return (
    <PublicPageLayout>
      <div className="container mx-auto px-4 sm:px-6 py-12 max-w-7xl">
        <div className="text-center mb-10">
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            Tournament Listings
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Browse approved Science Olympiad invitationals and registration details in one place.
          </p>
        </div>

        <Card className="mb-8 border-teamy-primary/20 bg-teamy-primary/5">
          <CardContent className="p-5 md:p-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
              Hosting a tournament on Teamy? Submit your request and manage organizer workflows through our tournament tools.
            </p>
            <Link href="/host-tournament" className="md:shrink-0">
              <Button>Host on Teamy</Button>
            </Link>
          </CardContent>
        </Card>

        <DashboardTournamentsClient />
      </div>
    </PublicPageLayout>
  )
}
