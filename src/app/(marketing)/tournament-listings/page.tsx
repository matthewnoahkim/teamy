import Link from 'next/link'
import { PublicPageLayout } from '@/components/public-page-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getPublicApprovedTournamentRequests } from '@/lib/public-tournament-listings'
import { formatDivision } from '@/lib/utils'
import { ExternalLink, MapPin, Monitor, Search, Trophy } from 'lucide-react'

export const metadata = {
  title: 'Tournament Listings | Teamy',
  description: 'Browse approved Science Olympiad tournaments and invitational competitions.',
}

type TournamentListingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type DivisionFilter = 'all' | 'B' | 'C'
type LevelFilter = 'all' | 'invitational' | 'regional' | 'state' | 'national'

function normalizeDivisionFilter(value: string | string[] | undefined): DivisionFilter {
  if (value === 'B' || value === 'C') {
    return value
  }

  return 'all'
}

function normalizeLevelFilter(value: string | string[] | undefined): LevelFilter {
  if (
    value === 'invitational' ||
    value === 'regional' ||
    value === 'state' ||
    value === 'national'
  ) {
    return value
  }

  return 'all'
}

function getLevelLabel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function getFormatLabel(format: string) {
  switch (format) {
    case 'in-person':
      return 'In-Person'
    case 'satellite':
      return 'Satellite'
    case 'mini-so':
      return 'Mini SO'
    default:
      return format
  }
}

function getTournamentSlug(preferredSlug: string | null, tournamentName: string) {
  if (preferredSlug) return preferredSlug

  return tournamentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default async function TournamentListingsPage({ searchParams }: TournamentListingsPageProps) {
  const resolvedSearchParams = await searchParams
  const searchValue = typeof resolvedSearchParams?.q === 'string' ? resolvedSearchParams.q.trim() : ''
  const divisionValue = normalizeDivisionFilter(resolvedSearchParams?.division)
  const levelValue = normalizeLevelFilter(resolvedSearchParams?.level)

  const tournaments = await getPublicApprovedTournamentRequests({
    division: divisionValue,
    level: levelValue,
    search: searchValue || undefined,
  })

  const hasFilters = Boolean(searchValue || divisionValue !== 'all' || levelValue !== 'all')

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

        <Card className="mb-8">
          <CardContent className="p-5 md:p-6">
            <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-end">
              <div className="space-y-2">
                <label htmlFor="search" className="text-sm font-medium text-foreground">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="search"
                    name="q"
                    defaultValue={searchValue}
                    placeholder="Search tournaments or locations..."
                    className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="division" className="text-sm font-medium text-foreground">
                  Division
                </label>
                <select
                  id="division"
                  name="division"
                  defaultValue={divisionValue}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All Divisions</option>
                  <option value="B">Division B</option>
                  <option value="C">Division C</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="level" className="text-sm font-medium text-foreground">
                  Level
                </label>
                <select
                  id="level"
                  name="level"
                  defaultValue={levelValue}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All Levels</option>
                  <option value="invitational">Invitational</option>
                  <option value="regional">Regional</option>
                  <option value="state">State</option>
                  <option value="national">National</option>
                </select>
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1 md:flex-none">
                  Apply
                </Button>
                {hasFilters && (
                  <Button asChild variant="outline" className="flex-1 md:flex-none">
                    <Link href="/tournament-listings">Clear</Link>
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {tournaments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-lg font-semibold text-foreground">No tournaments found</h2>
              <p className="text-muted-foreground">
                {hasFilters ? 'Try adjusting your filters.' : 'No approved tournaments are listed right now.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/tournaments/${getTournamentSlug(tournament.preferredSlug, tournament.tournamentName)}`}
                className="block"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Card className="h-full transition-all hover:border-teamy-primary/50 hover:shadow-lg">
                  <CardContent className="flex h-full flex-col gap-4 p-6">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Division {formatDivision(tournament.division)}</Badge>
                      <Badge variant="outline">{getLevelLabel(tournament.tournamentLevel)}</Badge>
                      <Badge variant="outline">{getFormatLabel(tournament.tournamentFormat)}</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <h2 className="text-xl font-semibold leading-snug text-foreground">
                          {tournament.tournamentName}
                        </h2>
                        <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>

                      {tournament.otherNotes && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {tournament.otherNotes}
                        </p>
                      )}
                    </div>

                    {tournament.tournamentFormat === 'in-person' && tournament.location ? (
                      <div className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">{tournament.location}</span>
                      </div>
                    ) : tournament.tournamentFormat !== 'in-person' ? (
                      <div className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
                        <Monitor className="h-4 w-4 shrink-0" />
                        <span>{getFormatLabel(tournament.tournamentFormat)} Tournament</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicPageLayout>
  )
}
