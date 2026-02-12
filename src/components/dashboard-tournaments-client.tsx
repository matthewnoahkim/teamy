'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AppHeader } from '@/components/app-header'
import { useToast } from '@/components/ui/use-toast'
import { PageLoading } from '@/components/ui/loading-spinner'
import { Search, MapPin, Trophy, Monitor, User, Mail, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatDivision } from '@/lib/utils'

interface TournamentRequest {
  id: string
  tournamentName: string
  tournamentLevel: string
  division: string
  tournamentFormat: string
  location: string | null
  preferredSlug: string | null
  directorName: string
  directorEmail: string
  directorPhone: string | null
  otherNotes: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewNotes: string | null
  createdAt: string
}

interface DashboardTournamentsClientProps {
  user?: {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }
}

export function DashboardTournamentsClient({ user }: DashboardTournamentsClientProps) {
  const { toast } = useToast()
  const [tournaments, setTournaments] = useState<TournamentRequest[]>([])
  const [loading, setLoading] = useState(true)
  
  // Initialize with default values
  const [search, setSearch] = useState('')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')

  useEffect(() => {
    loadTournaments()
  }, [])

  const loadTournaments = async () => {
    try {
      setLoading(true)
      // Fetch approved tournament hosting requests
      const response = await fetch('/api/tournament-requests?status=APPROVED')
      if (!response.ok) throw new Error('Failed to load tournaments')
      
      const data = await response.json()
      setTournaments(data.requests || [])
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load tournaments',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredTournaments = tournaments.filter(t => {
    // Division filter
    if (divisionFilter !== 'all') {
      if (divisionFilter === 'B' && !t.division.includes('B')) return false
      if (divisionFilter === 'C' && !t.division.includes('C')) return false
    }
    // Level filter
    if (levelFilter !== 'all' && t.tournamentLevel !== levelFilter) {
      return false
    }
    // Search
    if (search) {
      const searchLower = search.toLowerCase()
      const nameMatch = t.tournamentName.toLowerCase().includes(searchLower)
      const directorMatch = t.directorName.toLowerCase().includes(searchLower)
      const locationMatch = t.location?.toLowerCase().includes(searchLower) || false
      if (!nameMatch && !directorMatch && !locationMatch) {
        return false
      }
    }
    return true
  })

  const getLevelLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1)
  }

  const getFormatLabel = (format: string) => {
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

  const getTournamentSlug = (tournament: TournamentRequest) => {
    if (tournament.preferredSlug) {
      return tournament.preferredSlug
    }
    // Generate slug from tournament name
    return tournament.tournamentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  // Helper function to highlight search keywords in text
  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery?.trim() || !text) {
      return text
    }

    const query = searchQuery.trim()
    const queryLower = query.toLowerCase()
    const textLower = text.toLowerCase()
    
    // Find all occurrences of the query in the text
    const indices: number[] = []
    let index = textLower.indexOf(queryLower)
    while (index !== -1) {
      indices.push(index)
      index = textLower.indexOf(queryLower, index + 1)
    }

    if (indices.length === 0) {
      return text
    }

    // Build array of parts (text segments and highlighted segments)
    const parts: Array<{ text: string; highlight: boolean }> = []
    let lastIndex = 0

    indices.forEach((startIndex) => {
      // Add text before the match
      if (startIndex > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, startIndex),
          highlight: false
        })
      }
      // Add the highlighted match
      parts.push({
        text: text.substring(startIndex, startIndex + query.length),
        highlight: true
      })
      lastIndex = startIndex + query.length
    })

    // Add remaining text after last match
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        highlight: false
      })
    }

    return (
      <>
        {parts.map((part, index) => {
          if (part.highlight) {
            return (
              <mark
                key={index}
                className="bg-yellow-200 dark:bg-yellow-900/50 text-foreground px-0.5 rounded font-medium"
              >
                {part.text}
              </mark>
            )
          }
          return <span key={index}>{part.text}</span>
        })}
      </>
    )
  }

  return (
    <>
      {/* Show AppHeader only when user is provided (used in dashboard context) */}
      {user && <AppHeader user={user} />}
      
      <div className={user ? "relative z-10 container mx-auto px-4 py-8 max-w-7xl" : ""}>
        {/* Show title/description only when user is provided (dashboard context) */}
        {user && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Tournaments</h1>
              <p className="text-muted-foreground">
                Discover approved Science Olympiad tournaments
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10 shrink-0 will-change-transform" />
              <Input
                placeholder="Search tournaments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12"
              />
            </div>
            <Select value={divisionFilter} onValueChange={setDivisionFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Division" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                <SelectItem value="B">Division B</SelectItem>
                <SelectItem value="C">Division C</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="invitational">Invitational</SelectItem>
                <SelectItem value="regional">Regional</SelectItem>
                <SelectItem value="state">State</SelectItem>
                <SelectItem value="national">National</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tournament List */}
        {loading ? (
          <PageLoading title="Loading tournaments" description="Fetching tournament data..." />
        ) : filteredTournaments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No tournaments found</h3>
              <p className="text-muted-foreground mb-4">
                {search || divisionFilter !== 'all' || levelFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No approved tournaments at this time'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTournaments.map((tournament) => (
              <Link 
                key={tournament.id} 
                href={`/tournaments/${getTournamentSlug(tournament)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Card className="hover:shadow-lg transition-all hover:border-teamy-primary/50 cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant="outline">Division {formatDivision(tournament.division)}</Badge>
                      <Badge variant="outline">{getLevelLabel(tournament.tournamentLevel)}</Badge>
                      <Badge variant="outline">{getFormatLabel(tournament.tournamentFormat)}</Badge>
                    </div>
                    <CardTitle className="text-xl break-words leading-snug flex items-center gap-2">
                      {highlightText(tournament.tournamentName, search)}
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardTitle>
                    {tournament.otherNotes && (
                      <CardDescription className="line-clamp-2">
                        {tournament.otherNotes}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {tournament.tournamentFormat === 'in-person' && tournament.location ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{highlightText(tournament.location, search)}</span>
                      </div>
                    ) : tournament.tournamentFormat !== 'in-person' ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Monitor className="h-4 w-4" />
                        <span>{getFormatLabel(tournament.tournamentFormat)} Tournament</span>
                      </div>
                    ) : null}
                    
                    <div className="pt-3 border-t space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Director: {highlightText(tournament.directorName, search)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{tournament.directorEmail}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
