import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership, isAdmin } from '@/lib/rbac'
import { sendAnnouncementEmail } from '@/lib/email'
import { z } from 'zod'
import { AnnouncementScope } from '@prisma/client'

const createAnnouncementSchema = z.object({
  clubId: z.string(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  scope: z.enum(['CLUB', 'TEAM']),
  teamIds: z.array(z.string()).optional(),
  targetRoles: z.array(z.enum(['COACH', 'CAPTAIN', 'MEMBER'])).optional(),
  targetEvents: z.array(z.string()).optional(),
  sendEmail: z.boolean().default(true),
  calendarEventId: z.string().optional(),
  important: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = createAnnouncementSchema.parse(body)

    // Only admins can create announcements
    const isAdminUser = await isAdmin(session.user.id, validated.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can create announcements' },
        { status: 403 }
      )
    }

    await requireMember(session.user.id, validated.clubId)

    const membership = await getUserMembership(session.user.id, validated.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Validate team IDs if provided
    if (validated.scope === 'TEAM' && (!validated.teamIds || validated.teamIds.length === 0)) {
      return NextResponse.json({ error: 'Team IDs required for TEAM scope' }, { status: 400 })
    }

    // Create announcement with visibilities
    const announcement = await prisma.$transaction(async (tx) => {
      const ann = await tx.announcement.create({
        data: {
          clubId: validated.clubId,
          authorId: membership.id,
          title: validated.title,
          content: validated.content,
          calendarEventId: validated.calendarEventId,
          important: validated.important || false,
        },
      })

      // Create visibility records
      if (validated.scope === 'CLUB') {
        await tx.announcementVisibility.create({
          data: {
            announcementId: ann.id,
            scope: AnnouncementScope.CLUB,
          },
        })
      } else if (validated.teamIds) {
        await Promise.all(
          validated.teamIds.map((teamId) =>
            tx.announcementVisibility.create({
              data: {
                announcementId: ann.id,
                scope: AnnouncementScope.TEAM,
                teamId,
              },
            })
          )
        )
      }

      // Create additional visibility records for role targeting
      if (validated.targetRoles && validated.targetRoles.length > 0) {
        await Promise.all(
          validated.targetRoles.map((role) =>
            tx.announcementVisibility.create({
              data: {
                announcementId: ann.id,
                scope: validated.scope === 'CLUB' ? AnnouncementScope.CLUB : AnnouncementScope.TEAM,
                targetRole: role,
              },
            })
          )
        )
      }

      // Create additional visibility records for event targeting
      if (validated.targetEvents && validated.targetEvents.length > 0) {
        await Promise.all(
          validated.targetEvents.map((eventId) =>
            tx.announcementVisibility.create({
              data: {
                announcementId: ann.id,
                scope: validated.scope === 'CLUB' ? AnnouncementScope.CLUB : AnnouncementScope.TEAM,
                eventId,
              },
            })
          )
        )
      }

      return ann
    })

    // Send emails if requested
    if (validated.sendEmail) {
      const club = await prisma.club.findUnique({
        where: { id: validated.clubId },
        select: { name: true },
      })

      // Get all club memberships with role info
      const allMemberships = await prisma.membership.findMany({
        where: { clubId: validated.clubId },
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      })

      // Get the author (admin who posted)
      const author = allMemberships.find(m => m.id === membership.id)
      const authorEmail = author?.user.email

      if (!authorEmail) {
        console.error('Author email not found for announcement', announcement.id)
      }

      // Get all admins (will be CC'd) - exclude the author
      const admins = allMemberships.filter(m => String(m.role) === 'ADMIN' && m.id !== membership.id)
      const adminEmails = admins.map(a => a.user.email).filter(Boolean)

      // Get target members based on scope (will be BCC'd)
      let targetMembers: { email: string; id: string }[] = []

      if (validated.scope === 'CLUB') {
        // All members (exclude admins and author)
        targetMembers = allMemberships
          .filter(m => m.role === 'MEMBER')
          .map(m => ({ email: m.user.email, id: m.user.id }))
          .filter(m => m.email)
      } else if (validated.teamIds) {
        // Members in selected teams
        const teamMemberships = allMemberships.filter(m => 
          m.role === 'MEMBER' && m.teamId && validated.teamIds?.includes(m.teamId)
        )
        targetMembers = teamMemberships
          .map(m => ({ email: m.user.email, id: m.user.id }))
          .filter(m => m.email)
      }

      // Get calendar event details if this announcement is linked to an event
      let calendarEventDetails: {
        startUTC: Date
        endUTC: Date
        location?: string
        description?: string
        rsvpEnabled?: boolean
      } | null = null
      if (validated.calendarEventId) {
        const calEvent = await prisma.calendarEvent.findUnique({
          where: { id: validated.calendarEventId },
          select: {
            startUTC: true,
            endUTC: true,
            location: true,
            description: true,
            rsvpEnabled: true,
          },
        })
        if (calEvent) {
          calendarEventDetails = {
            startUTC: calEvent.startUTC,
            endUTC: calEvent.endUTC,
            location: calEvent.location ?? undefined,
            description: calEvent.description ?? undefined,
            rsvpEnabled: calEvent.rsvpEnabled,
          }
        }
      }

      // Only send email if we have valid recipients
      if (authorEmail && (adminEmails.length > 0 || targetMembers.length > 0)) {
        // Send one email with CC and BCC (don't await to not block response)
        Promise.resolve().then(async () => {
          try {
            const result = await sendAnnouncementEmail({
              to: [authorEmail], // Send to author as primary recipient
              cc: adminEmails.length > 0 ? adminEmails : undefined, // CC all other admins
              bcc: targetMembers.length > 0 ? targetMembers.map(u => u.email) : undefined, // BCC all members
              replyTo: authorEmail,
              clubId: validated.clubId,
              clubName: club?.name || 'Club',
              title: validated.title,
              content: validated.content,
              announcementId: announcement.id,
              calendarEvent: calendarEventDetails || undefined,
            })

            // Log email for all recipients (admins + members, not the author)
            const allRecipients = [
              ...admins.map(a => ({ id: a.userId, email: a.user.email })),
              ...targetMembers,
            ].filter(r => r.email && r.id)

            if (allRecipients.length > 0) {
              await Promise.all(
                allRecipients.map(recipient =>
                  prisma.emailLog.create({
                    data: {
                      announcementId: announcement.id,
                      toUserId: recipient.id,
                      subject: `[${club?.name}] ${validated.title}`,
                      providerMessageId: result.messageId,
                    },
                  }).catch(err => console.error('Failed to log email for', recipient.email, err))
                )
              )
            }
          } catch (emailError) {
            console.error('Email sending failed:', emailError)
          }
        }).catch(error => console.error('Email sending promise error:', error))
      } else {
        console.warn('No valid email recipients found, skipping email send')
      }
    }

    const fullAnnouncement = await prisma.announcement.findUnique({
      where: { id: announcement.id },
      include: {
        author: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        visibilities: {
          include: {
            team: true,
          },
        },
        calendarEvent: {
          include: {
            rsvps: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
            team: true,
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ announcement: fullAnnouncement })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Announcement validation error:', error.issues)
      return NextResponse.json({ 
        error: 'Invalid announcement data', 
        message: 'Please check all required fields',
        details: error.issues 
      }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'You do not have permission to post announcements' }, { status: 403 })
    }
    
    console.error('Create announcement error:', error)
    
    // Make Prisma errors more readable
    let userFriendlyMessage = 'Failed to post announcement'
    if (error instanceof Error) {
      if (error.message.includes('Unknown argument')) {
        userFriendlyMessage = 'Invalid data submitted'
      } else if (error.message.includes('Foreign key constraint')) {
        userFriendlyMessage = 'Invalid club or team selected'
      } else if (error.message.includes('Unique constraint')) {
        userFriendlyMessage = 'This announcement conflicts with an existing record'
      }
    }
    
    return NextResponse.json({ 
      error: userFriendlyMessage,
      message: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : String(error))
        : 'An error occurred while posting the announcement'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    await requireMember(session.user.id, clubId)

    const membership = await getUserMembership(session.user.id, clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, clubId)

    // Get announcements visible to this user
    // Admins can see all announcements, regular members only see club-wide and their team
    const announcements = await prisma.announcement.findMany({
      where: {
        clubId,
        // Admins see all announcements for the club
        ...(isAdminUser ? {} : {
          OR: [
            // Club-wide announcements
            {
              visibilities: {
                some: {
                  scope: AnnouncementScope.CLUB,
                },
              },
            },
            // Team announcements for user's team
            ...(membership.teamId
              ? [{
                  visibilities: {
                    some: {
                      scope: AnnouncementScope.TEAM,
                      teamId: membership.teamId,
                    },
                  },
                }]
              : []),
          ],
        }),
      },
      include: {
        author: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        visibilities: {
          include: {
            team: true,
          },
        },
        replies: {
          include: {
            author: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
            reactions: true,
          },
        },
        calendarEvent: {
          include: {
            rsvps: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
            team: true,
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ announcements })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get announcements error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
