import { PublicPageLayout } from '@/components/public-page-layout'
import { prisma } from '@/lib/prisma'
import { Calendar, MapPin, Trophy, Users } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function TournamentListingsPage() {
  const tournaments = await prisma.tournament.findMany({
    where: {
      published: true,
      approved: true,
    },
    orderBy: {
      startDate: 'asc',
    },
    take: 50,
  })

  return (
    <PublicPageLayout>
      <div className="py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Tournament Listings
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Browse and register for upcoming Science Olympiad tournaments
            </p>
          </div>

          {/* Tournaments */}
          {tournaments.length === 0 ? (
            <div className="text-center py-20">
              <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-6 opacity-50" />
              <p className="text-muted-foreground text-lg">No tournaments available at this time.</p>
              <p className="text-muted-foreground text-sm mt-2">Check back soon for upcoming tournaments!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.slug}`}
                  className="group block"
                >
                  <div className="h-full p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-card-hover hover:border-teamy-primary/20 transition-all duration-300">
                    {/* Division Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teamy-primary/10 text-teamy-primary text-xs font-semibold mb-4">
                      Division {tournament.division}
                    </div>

                    {/* Title */}
                    <h3 className="font-heading text-xl font-bold mb-3 text-foreground group-hover:text-teamy-primary transition-colors line-clamp-2">
                      {tournament.name}
                    </h3>

                    {/* Details */}
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>{format(new Date(tournament.startDate), 'MMM d, yyyy')}</span>
                      </div>
                      {tournament.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="line-clamp-1">{tournament.location}</span>
                        </div>
                      )}
                      {tournament.isOnline && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 flex-shrink-0" />
                          <span>Online Tournament</span>
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    {tournament.price > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="text-sm text-muted-foreground">
                          Starting at <span className="font-semibold text-foreground">${tournament.price}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicPageLayout>
  )
}

