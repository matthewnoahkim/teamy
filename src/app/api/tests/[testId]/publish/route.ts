import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { isAdmin, getUserMembership } from '@/lib/rbac'
import { hashTestPassword } from '@/lib/test-security'
import { z } from 'zod'

const publishSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  testPassword: z.string().min(6).optional(),
  releaseScoresAt: z.string().datetime().optional(),
  sendEmails: z.boolean().optional(),
  durationMinutes: z.number().min(1).optional(),
  maxAttempts: z.number().min(1).optional().nullable(),
  scoreReleaseMode: z.enum(['NONE', 'SCORE_ONLY', 'SCORE_WITH_WRONG', 'FULL_TEST']).optional(),
  requireFullscreen: z.boolean().optional(),
  assignmentMode: z.enum(['CLUB', 'TEAM', 'EVENT']).optional(),
  selectedTeams: z.array(z.string()).optional(),
  selectedEventId: z.string().optional(),
  addToCalendar: z.boolean().optional(),
})

// POST /api/tests/[testId]/publish
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> | { testId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const testId = resolvedParams.testId

    const body = await req.json()
    const validatedData = publishSchema.parse(body)

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: true,
        assignments: {
          include: {
            team: true,
            event: true,
          },
        },
      },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    // Check if user is an admin
    const isAdminUser = await isAdmin(session.user.id, test.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can publish tests' },
        { status: 403 }
      )
    }

    // Check if test has questions
    if (test.questions.length === 0) {
      return NextResponse.json(
        { error: 'Cannot publish test without questions' },
        { status: 400 }
      )
    }

    // Validate dates
    const startAt = new Date(validatedData.startAt)
    const endAt = new Date(validatedData.endAt)
    if (endAt <= startAt) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      )
    }

    // Hash test password if provided
    const testPasswordHash = validatedData.testPassword
      ? await hashTestPassword(validatedData.testPassword)
      : null
    const testPasswordPlaintext = validatedData.testPassword || null

    // Get membership for audit
    const membership = await getUserMembership(session.user.id, test.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Update test status, scheduling, password, and score release
    const updatedTest = await prisma.test.update({
      where: { id: testId },
      data: {
        status: 'PUBLISHED',
        startAt,
        endAt,
        testPasswordHash,
        testPasswordPlaintext,
        releaseScoresAt: validatedData.releaseScoresAt
          ? new Date(validatedData.releaseScoresAt)
          : null,
        ...(validatedData.scoreReleaseMode && { scoreReleaseMode: validatedData.scoreReleaseMode as any }),
        ...(validatedData.durationMinutes && { durationMinutes: validatedData.durationMinutes }),
        ...(validatedData.maxAttempts !== undefined && { maxAttempts: validatedData.maxAttempts }),
        ...(validatedData.requireFullscreen !== undefined && { requireFullscreen: validatedData.requireFullscreen }),
      },
    })

    // Handle assignments if provided
    if (validatedData.assignmentMode) {
      // First, delete existing assignments
      await prisma.testAssignment.deleteMany({
        where: { testId },
      })

      // Create new assignments based on mode
      if (validatedData.assignmentMode === 'CLUB') {
        await prisma.testAssignment.create({
          data: {
            testId,
            assignedScope: 'CLUB',
          },
        })
      } else if (validatedData.assignmentMode === 'TEAM' && validatedData.selectedTeams) {
        await prisma.testAssignment.createMany({
          data: validatedData.selectedTeams.map(teamId => ({
            testId,
            assignedScope: 'TEAM' as const,
            teamId,
          })),
        })
      } else if (validatedData.assignmentMode === 'EVENT' && validatedData.selectedEventId) {
        // Find all members assigned to this event via roster assignments
        const rosterAssignments = await prisma.rosterAssignment.findMany({
          where: {
            eventId: validatedData.selectedEventId,
            team: {
              clubId: test.clubId,
            },
          },
          select: {
            membershipId: true,
          },
        })

        const uniqueMembershipIds = [...new Set(rosterAssignments.map(ra => ra.membershipId))]

        if (uniqueMembershipIds.length > 0) {
          await prisma.testAssignment.createMany({
            data: uniqueMembershipIds.map(membershipId => ({
              testId,
              assignedScope: 'PERSONAL' as const,
              targetMembershipId: membershipId,
            })),
          })
        }
      }
    }

    // Create audit log
    await prisma.testAudit.create({
      data: {
        testId: test.id,
        actorMembershipId: membership.id,
        action: 'PUBLISH',
        details: {
          testName: test.name,
          questionCount: test.questions.length,
        },
      },
    })

    // Create calendar event if requested
    let calendarEventIds: string[] = []
    if (validatedData.addToCalendar) {
      // Get the final assignments (either from the request or existing ones)
      const finalAssignments = validatedData.assignmentMode
        ? await prisma.testAssignment.findMany({
            where: { testId },
          })
        : test.assignments

      if (finalAssignments.length > 0) {
        // Determine calendar event scope and target users
        const hasClubAssignment = finalAssignments.some(a => a.assignedScope === 'CLUB')
        const teamAssignments = finalAssignments.filter(a => a.assignedScope === 'TEAM' && a.teamId)
        const personalAssignments = finalAssignments.filter(a => a.assignedScope === 'PERSONAL' && a.targetMembershipId)
        const eventAssignments = finalAssignments.filter(a => a.eventId)

        if (hasClubAssignment) {
          // Entire club - create one CLUB scope event
          const calendarEvent = await prisma.calendarEvent.create({
            data: {
              clubId: test.clubId,
              creatorId: membership.id,
              scope: 'CLUB',
              title: test.name,
              description: test.description || `Test: ${test.name}`,
              startUTC: startAt,
              endUTC: endAt,
              color: '#8b5cf6', // Purple color for tests
              rsvpEnabled: false, // Tests don't need RSVP
              important: true, // Tests are important events
              testId: testId,
            },
          })
          calendarEventIds.push(calendarEvent.id)
        } else if (teamAssignments.length > 0) {
          // Specific teams - create one TEAM event per team
          const createdEvents = await Promise.all(
            teamAssignments.map(async (assignment) => {
              if (!assignment.teamId) return null
              return await prisma.calendarEvent.create({
                data: {
                  clubId: test.clubId,
                  creatorId: membership.id,
                  scope: 'TEAM',
                  title: test.name,
                  description: test.description || `Test: ${test.name}`,
                  startUTC: startAt,
                  endUTC: endAt,
                  color: '#8b5cf6',
                  rsvpEnabled: false,
                  important: true,
                  teamId: assignment.teamId,
                  testId: testId,
                },
              })
            })
          )
          calendarEventIds.push(...createdEvents.filter(e => e !== null).map(e => e!.id))
        } else if (eventAssignments.length > 0) {
          // Event-based assignments - create one CLUB scope event with event targets
          const uniqueEventIds = [...new Set(eventAssignments.map(a => a.eventId).filter(Boolean) as string[])]
          const calendarEvent = await prisma.calendarEvent.create({
            data: {
              clubId: test.clubId,
              creatorId: membership.id,
              scope: 'CLUB',
              title: test.name,
              description: test.description || `Test: ${test.name}`,
              startUTC: startAt,
              endUTC: endAt,
              color: '#8b5cf6',
              rsvpEnabled: false,
              important: true,
              testId: testId,
            },
          })
          calendarEventIds.push(calendarEvent.id)

          // Create calendar event targets for event-based assignments
          await Promise.all(
            uniqueEventIds.map(eventId =>
              prisma.calendarEventTarget.create({
                data: {
                  calendarEventId: calendarEvent.id,
                  eventId: eventId,
                },
              })
            )
          )
        } else if (personalAssignments.length > 0) {
          // Personal assignments - create one PERSONAL event per user
          const createdEvents = await Promise.all(
            personalAssignments.map(async (assignment) => {
              if (!assignment.targetMembershipId) return null
              return await prisma.calendarEvent.create({
                data: {
                  clubId: test.clubId,
                  creatorId: membership.id,
                  scope: 'PERSONAL',
                  title: test.name,
                  description: test.description || `Test: ${test.name}`,
                  startUTC: startAt,
                  endUTC: endAt,
                  color: '#8b5cf6',
                  rsvpEnabled: false,
                  important: true,
                  attendeeId: assignment.targetMembershipId,
                  testId: testId,
                },
              })
            })
          )
          calendarEventIds.push(...createdEvents.filter(e => e !== null).map(e => e!.id))
        }
      }
    }

    // TODO: Send emails if sendEmails is true
    // Get assignments and send notifications to assigned users

    return NextResponse.json({ test: updatedTest, calendarEventIds })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Publish test error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    )
  }
}

