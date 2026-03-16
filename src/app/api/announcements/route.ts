import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as rbac from '@/lib/rbac'
import { sendAnnouncementEmail } from '@/lib/email'
import { logApiTiming } from '@/lib/api-timing'
import { hasAnnouncementTargetAccess } from '@/lib/club-authz'
import { serverSession } from '@/lib/server-session'
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

type AnnouncementEmailJob = {
  announcementId: string
  clubId: string
  membershipId: string
  scope: z.infer<typeof createAnnouncementSchema>['scope']
  teamIds?: string[]
  calendarEventId?: string
  title: string
  content: string
}

async function sendAnnouncementEmailsInBackground(job: AnnouncementEmailJob) {
  try {
    const club = await prisma.club.findUnique({
      where: { id: job.clubId },
      select: { name: true },
    })

    const allMemberships = await prisma.membership.findMany({
      where: { clubId: job.clubId },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    })

    const author = allMemberships.find(m => m.id === job.membershipId)
    const authorEmail = author?.user.email

    if (!authorEmail) {
      console.error('Author email not found for announcement', job.announcementId)
      return
    }

    const admins = allMemberships.filter(m => String(m.role) === 'ADMIN' && m.id !== job.membershipId)
    const adminEmails = admins.map(a => a.user.email).filter(Boolean)

    let targetMembers: { email: string; id: string }[] = []

    if (job.scope === 'CLUB') {
      targetMembers = allMemberships
        .filter(m => m.role === 'MEMBER')
        .map(m => ({ email: m.user.email, id: m.user.id }))
        .filter(m => m.email)
    } else if (job.teamIds) {
      const teamMemberships = allMemberships.filter(m =>
        m.role === 'MEMBER' && m.teamId && job.teamIds?.includes(m.teamId),
      )
      targetMembers = teamMemberships
        .map(m => ({ email: m.user.email, id: m.user.id }))
        .filter(m => m.email)
    }

    let calendarEventDetails: {
      startUTC: Date
      endUTC: Date
      location?: string
      description?: string
      rsvpEnabled?: boolean
    } | null = null

    if (job.calendarEventId) {
      const calEvent = await prisma.calendarEvent.findUnique({
        where: { id: job.calendarEventId },
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

    if (adminEmails.length === 0 && targetMembers.length === 0) {
      console.warn('No valid email recipients found, skipping email send')
      return
    }

    const result = await sendAnnouncementEmail({
      to: [authorEmail],
      cc: adminEmails.length > 0 ? adminEmails : undefined,
      bcc: targetMembers.length > 0 ? targetMembers.map(u => u.email) : undefined,
      replyTo: authorEmail,
      clubId: job.clubId,
      clubName: club?.name || 'Club',
      title: job.title,
      content: job.content,
      announcementId: job.announcementId,
      calendarEvent: calendarEventDetails || undefined,
    })

    const allRecipients = [
      ...admins.map(a => ({ id: a.userId, email: a.user.email })),
      ...targetMembers,
    ].filter(r => r.email && r.id)

    if (allRecipients.length === 0) {
      return
    }

    await Promise.all(
      allRecipients.map(recipient =>
        prisma.emailLog.create({
          data: {
            announcementId: job.announcementId,
            toUserId: recipient.id,
            subject: `[${club?.name}] ${job.title}`,
            providerMessageId: result.messageId,
          },
        }).catch(err => console.error('Failed to log email for', recipient.email, err)),
      ),
    )
  } catch (emailError) {
    console.error('Email sending failed:', emailError)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = createAnnouncementSchema.parse(body)

    const membership = await rbac.getUserMembership(session.user.id, validated.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only admins can create announcements
    if (membership.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can create announcements' },
        { status: 403 }
      )
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

    if (validated.sendEmail) {
      after(async () => {
        await sendAnnouncementEmailsInBackground({
          announcementId: announcement.id,
          clubId: validated.clubId,
          membershipId: membership.id,
          scope: validated.scope,
          teamIds: validated.teamIds,
          calendarEventId: validated.calendarEventId,
          title: validated.title,
          content: validated.content,
        })
      })
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
  const startedAtMs = performance.now()
  try {
    const session = await serverSession.get()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clubId = searchParams.get('clubId')

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    const membership = await rbac.getUserMembership(session.user.id, clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const isAdminUser = membership.role === 'ADMIN'
    const userEventIds = !isAdminUser
      ? (await prisma.rosterAssignment.findMany({
          where: {
            membershipId: membership.id,
            team: { clubId },
          },
          select: {
            eventId: true,
          },
        })).map(assignment => assignment.eventId)
      : []

    // Get announcements visible to this user
    // Admins can see all announcements, regular members only see club-wide and their team
    const allVisibleAnnouncements = await prisma.announcement.findMany({
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
      take: 100,
    })

    const announcements = isAdminUser
      ? allVisibleAnnouncements
      : allVisibleAnnouncements.filter((announcement) => {
          const targets = announcement.visibilities
            .filter(visibility => visibility.targetRole || visibility.eventId)
            .map(visibility => ({
              targetRole: visibility.targetRole,
              eventId: visibility.eventId,
            }))
          return hasAnnouncementTargetAccess(targets, membership, userEventIds)
        })

    logApiTiming('/api/announcements', startedAtMs, {
      clubId,
      isAdmin: isAdminUser,
      resultCount: announcements.length,
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
