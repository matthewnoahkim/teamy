import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Division } from '@prisma/client'
import {
  sanitizeSearchQuery,
  validateId,
  validateInteger,
  validateBoolean,
  validateEnum,
} from '@/lib/input-validation'

// Helper to check if user is tournament admin
async function isTournamentAdmin(userId: string, tournamentId: string): Promise<boolean> {
  const admin = await prisma.tournamentAdmin.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId,
      },
    },
  })
  return !!admin
}

const createTournamentSchema = z.object({
  name: z.string().min(1).max(200),
  division: z.enum(['B', 'C']),
  description: z.string().optional(),
  price: z.number().min(0),
  paymentInstructions: z.string().optional(),
  isOnline: z.boolean().default(false),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
})

// GET /api/tournaments?division=B&search=name&upcoming=true
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    
    // Validate and sanitize all inputs
    const division = validateEnum(searchParams.get('division'), [Division.B, Division.C] as const)
    const search = sanitizeSearchQuery(searchParams.get('search'), 200)
    const upcomingParam = validateBoolean(searchParams.get('upcoming'))
    const createdByParam = searchParams.get('createdBy')
    const managedByParam = searchParams.get('managedBy')
    const teamRegisteredParam = validateBoolean(searchParams.get('teamRegistered'))
    const pendingApprovalParam = validateBoolean(searchParams.get('pendingApproval'))
    const sortBy = validateEnum(searchParams.get('sortBy'), ['date-asc', 'date-desc', 'name-asc', 'name-desc', 'price-asc', 'price-desc', 'popularity-asc', 'popularity-desc'] as const, 'date-asc') ?? 'date-asc'
    
    // Only filter by upcoming if explicitly set to 'true'
    // If not provided or 'false', return ALL tournaments (past and future)
    const upcoming = upcomingParam === true
    
    // Filter by creator if 'me' is passed (current user) or a specific user ID (validated)
    const createdBy = createdByParam === 'me' 
      ? session.user.id 
      : validateId(createdByParam) ?? undefined
    
    // Filter by tournaments managed by user (creator or admin) - validate ID
    const managedBy = managedByParam === 'me' 
      ? session.user.id 
      : validateId(managedByParam) ?? undefined
    
    // Filter by tournaments where user's team is registered
    const teamRegistered = teamRegisteredParam === true
    
    // Filter by tournaments pending approval (created by user but not approved)
    const pendingApproval = pendingApprovalParam === true

    const where: any = {}
    
    // Check if we should include unapproved tournaments (for dev panel)
    const includeUnapproved = searchParams.get('includeUnapproved') === 'true'
    
    // Only show approved tournaments on the tournaments wall (unless filtering by createdBy/managedBy, pendingApproval, or includeUnapproved is true)
    // This allows creators/admins to see their own tournaments even if not approved
    // Dev panel can set includeUnapproved=true to see all tournaments
    // pendingApproval filter shows only unapproved tournaments created by the user
    if (!createdBy && !managedBy && !teamRegistered && !pendingApproval && !includeUnapproved) {
      where.approved = true
    }
    
    // Filter by pending approval tournaments (created by user but not approved)
    if (pendingApproval) {
      where.createdById = session.user.id
      where.approved = false
    }
    
    if (division) {
      where.division = division
    }
    
    if (search) {
      // Search is already sanitized
      where.name = {
        contains: search,
        mode: 'insensitive',
      }
    }
    
    // Filter by tournaments where user is creator or admin (takes precedence over createdBy)
    // Skip this if pendingApproval is set, as it already sets createdById
    if (managedBy && !pendingApproval) {
      const adminTournaments = await prisma.tournamentAdmin.findMany({
        where: { userId: managedBy },
        select: { tournamentId: true },
      })
      const adminTournamentIds = adminTournaments.map(a => a.tournamentId)
      
      // Get tournaments where user is creator or admin
      if (adminTournamentIds.length > 0) {
        where.OR = [
          { createdById: managedBy },
          { id: { in: adminTournamentIds } },
        ]
      } else {
        // User is only a creator, not an admin
        where.createdById = managedBy
      }
    } else if (createdBy && !pendingApproval) {
      // Only use createdBy if managedBy and pendingApproval are not set
      where.createdById = createdBy
    }

    // Filter by tournaments where user's team is registered
    if (teamRegistered) {
      // Get user's team memberships (only where teamId is not null)
      const userTeamMemberships = await prisma.membership.findMany({
        where: {
          userId: session.user.id,
          teamId: { not: null },
        },
        select: { teamId: true },
      })
      
      const userTeamIds = userTeamMemberships
        .map(m => m.teamId)
        .filter((id): id is string => id !== null)
      
      if (userTeamIds.length > 0) {
        // Get tournaments where any of user's teams are registered
        const teamRegistrations = await prisma.tournamentRegistration.findMany({
          where: {
            teamId: { in: userTeamIds },
          },
          select: { tournamentId: true },
        })
        
        const tournamentIds = [...new Set(teamRegistrations.map(r => r.tournamentId))]
        
        if (tournamentIds.length > 0) {
          // Combine with existing id filter if present, otherwise set it
          if (where.id && 'in' in where.id) {
            // Intersect the arrays
            const existingIds = Array.isArray(where.id.in) ? where.id.in : []
            where.id = { in: tournamentIds.filter(id => existingIds.includes(id)) }
          } else {
            where.id = { in: tournamentIds }
          }
        } else {
          // User has teams but no team registrations, return empty result
          where.id = { in: [] }
        }
      } else {
        // User has no teams, return empty result
        where.id = { in: [] }
      }
    }
    
    // Only filter by date if upcoming is explicitly 'true'
    // When upcoming is false, null, or not provided, return all tournaments
    if (upcoming) {
      // Use startTime for comparison to get tournaments that haven't started yet
      // Create a new Date object to get the current moment
      const now = new Date()
      // Filter out tournaments where startTime is less than or equal to now
      // Only show tournaments where startTime is greater than now (haven't started yet)
      where.startTime = {
        gt: now,
      }
    }

    // Determine orderBy based on sortBy parameter
    let orderBy: any = { startDate: 'asc' } // default
    
    if (sortBy === 'date-asc') {
      orderBy = { startDate: 'asc' }
    } else if (sortBy === 'date-desc') {
      orderBy = { startDate: 'desc' }
    } else if (sortBy === 'name-asc') {
      orderBy = { name: 'asc' }
    } else if (sortBy === 'name-desc') {
      orderBy = { name: 'desc' }
    } else if (sortBy === 'price-asc') {
      orderBy = { price: 'asc' }
    } else if (sortBy === 'price-desc') {
      orderBy = { price: 'desc' }
    } else if (sortBy === 'popularity-desc' || sortBy === 'popularity-asc') {
      // For popularity, we need to sort by registration count
      // This requires a more complex query, so we'll fetch and sort in memory
      orderBy = { startDate: 'asc' } // temporary, will sort after
    }

    const tournaments = await prisma.tournament.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        registrations: {
          include: {
            club: {
              select: {
                id: true,
                name: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy,
    })

    // Add isCreator and isAdmin flags to each tournament for the current user
    const tournamentsWithFlags = await Promise.all(
      tournaments.map(async (tournament) => {
        const isCreator = tournament.createdById === session.user.id
        const isAdmin = await isTournamentAdmin(session.user.id, tournament.id)
        return {
          ...tournament,
          isCreator,
          isAdmin: isAdmin || isCreator, // Admins include creators
        }
      })
    )

    // Sort by popularity if needed (since we can't easily do this in Prisma)
    if (sortBy === 'popularity-desc') {
      tournamentsWithFlags.sort((a, b) => b._count.registrations - a._count.registrations)
    } else if (sortBy === 'popularity-asc') {
      tournamentsWithFlags.sort((a, b) => a._count.registrations - b._count.registrations)
    }

    // Additional client-side filter as safety check if upcoming filter is active
    // This ensures tournaments that have already started are filtered out even if DB comparison fails
    let filteredTournaments = tournamentsWithFlags
    if (upcoming) {
      const now = new Date()
      filteredTournaments = tournamentsWithFlags.filter((tournament) => {
        const startTime = new Date(tournament.startTime)
        return startTime > now
      })
    }

    return NextResponse.json({ tournaments: filteredTournaments })
  } catch (error) {
    console.error('Get tournaments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tournaments
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = createTournamentSchema.parse(body)

    // Create tournament and make creator an admin
    const result = await prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          name: validated.name,
          division: validated.division as Division,
          description: validated.description,
          price: validated.price,
          paymentInstructions: validated.paymentInstructions,
          isOnline: validated.isOnline,
          startDate: new Date(validated.startDate),
          endDate: new Date(validated.endDate),
          startTime: new Date(validated.startTime),
          endTime: new Date(validated.endTime),
          location: validated.location,
          approved: false, // Default to false, needs approval
          createdById: session.user.id,
        },
      })

      // Make creator an admin
      await tx.tournamentAdmin.create({
        data: {
          tournamentId: tournament.id,
          userId: session.user.id,
        },
      })

      return tournament
    })

    // Send Discord webhook notification
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1444884965656498297/cYFv5fCpclifIVFzyi4a6tN3a5u_hpGE2AZGfPCT8hyJkfo96hcCdcYmBL-YvG2LOjXU'
    
    try {
      const discordPayload = {
        embeds: [
          {
            title: 'New Tournament Submission',
            color: 0x0056C7, // Teamy primary blue
            fields: [
              {
                name: 'Tournament Name',
                value: validated.name,
                inline: false,
              },
              {
                name: 'Division',
                value: `Division ${validated.division}`,
                inline: true,
              },
              {
                name: 'Registration Fee',
                value: `$${validated.price.toFixed(2)}`,
                inline: true,
              },
              {
                name: 'Location',
                value: validated.isOnline ? 'Online Tournament' : (validated.location || 'Not specified'),
                inline: true,
              },
              {
                name: 'Start Date',
                value: new Date(validated.startDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }),
                inline: true,
              },
              {
                name: 'End Date',
                value: new Date(validated.endDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                }),
                inline: true,
              },
              {
                name: 'Start Time',
                value: new Date(validated.startTime).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                }),
                inline: true,
              },
              {
                name: 'End Time',
                value: new Date(validated.endTime).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                }),
                inline: true,
              },
              {
                name: 'Description',
                value: validated.description 
                  ? (validated.description.length > 1024 
                      ? validated.description.substring(0, 1021) + '...' 
                      : validated.description)
                  : '*No description provided*',
                inline: false,
              },
              {
                name: 'Created By',
                value: `${session.user.name || 'Unknown'} (${session.user.email})`,
                inline: false,
              },
              {
                name: 'Tournament ID',
                value: result.id,
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Teamy Tournament System',
            },
          },
        ],
      }

      // Don't await to avoid blocking the response
      fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discordPayload),
      }).catch((error) => {
        console.error('Discord webhook failed:', error)
        // Don't fail the request if webhook fails
      })
    } catch (error) {
      console.error('Error sending Discord webhook:', error)
      // Don't fail the request if webhook fails
    }

    return NextResponse.json({ tournament: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Create tournament error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined 
    }, { status: 500 })
  }
}

