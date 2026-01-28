import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership, isAdmin } from '@/lib/rbac'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { z } from 'zod'

const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50MB for PDFs

const createNoteSheetSchema = z.object({
  type: z.enum(['CREATED', 'UPLOADED']),
  content: z.string().optional(), // For CREATED type
})

// POST - Create or upload note sheet
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First try to find as regular Test
    let test = await prisma.test.findUnique({
      where: { id: resolvedParams.testId },
      include: {
        club: true,
        assignments: {
          where: {
            eventId: { not: null },
          },
          select: {
            eventId: true,
          },
        },
      },
    })

    // If not found, check if it's an ESTest
    let esTest = null
    if (!test) {
      esTest = await prisma.eSTest.findUnique({
        where: { id: resolvedParams.testId },
        include: {
          tournament: {
            select: {
              id: true,
            },
          },
        },
      })

      if (esTest) {
        // Handle ESTest note sheets
        // Check if note sheets are enabled for this ESTest
        if (!esTest.allowNoteSheet) {
          return NextResponse.json(
            { error: 'Note sheets are not enabled for this test' },
            { status: 400 }
          )
        }

        // Check if ESTest is published (note sheets allowed for published tests even without startAt)
        if (esTest.status !== 'PUBLISHED') {
          return NextResponse.json(
            { error: 'Note sheets can only be created for published tests' },
            { status: 400 }
          )
        }

        // Get user memberships to find their registered teams/clubs
        const userMemberships = await prisma.membership.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            club: {
              select: {
                id: true,
              },
            },
            team: {
              select: {
                id: true,
              },
            },
          },
        })

        // Get team IDs and club IDs from memberships
        const teamIds = userMemberships
          .map((m) => m.teamId)
          .filter((id): id is string => id !== null)
        const clubIds = userMemberships.map((m) => m.clubId)

        // Check if user is registered for this tournament
        const registration = await prisma.tournamentRegistration.findFirst({
          where: {
            tournamentId: esTest.tournamentId,
            status: 'CONFIRMED',
            OR: [
              { teamId: { in: teamIds } },
              { clubId: { in: clubIds } },
            ],
          },
        })

        if (!registration) {
          return NextResponse.json(
            { error: 'You must be registered for this tournament to upload note sheets' },
            { status: 403 }
          )
        }

        // Find the membership that matches this registration
        const membership = registration.teamId
          ? userMemberships.find(
              (m) => m.clubId === registration.clubId && m.teamId === registration.teamId
            )
          : userMemberships.find((m) => m.clubId === registration.clubId)

        if (!membership) {
          return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
        }

        // Determine initial status based on autoApproveNoteSheet setting
        const initialStatus = esTest.autoApproveNoteSheet ? 'ACCEPTED' : 'PENDING'

        // Check if user already has a note sheet for this ESTest
        const existingNoteSheet = await prisma.noteSheet.findUnique({
          where: {
            esTestId_membershipId: {
              esTestId: resolvedParams.testId,
              membershipId: membership.id,
            },
          },
        })

        // Helper function to delete old note sheet and its file
        const deleteOldNoteSheet = async (noteSheet: any) => {
          if (noteSheet.filePath) {
            try {
              const fs = require('fs')
              const path = require('path')
              const filePath = path.join(process.cwd(), 'public', noteSheet.filePath)
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
              }
            } catch (err) {
              console.error('Failed to delete old note sheet file:', err)
            }
          }
          await prisma.noteSheet.delete({
            where: {
              id: noteSheet.id,
            },
          })
        }

        // If there's an existing note sheet, delete it to allow replacement
        if (existingNoteSheet) {
          await deleteOldNoteSheet(existingNoteSheet)
        }

        // Also delete note sheets for other tests in the same event (to replace them all)
        if (esTest.eventId) {
          const otherESTests = await prisma.eSTest.findMany({
            where: {
              eventId: esTest.eventId,
              tournamentId: esTest.tournamentId,
              id: { not: resolvedParams.testId },
              allowNoteSheet: true,
              status: 'PUBLISHED',
            },
            select: {
              id: true,
            },
          })

          for (const otherTest of otherESTests) {
            const existingOtherNoteSheet = await prisma.noteSheet.findUnique({
              where: {
                esTestId_membershipId: {
                  esTestId: otherTest.id,
                  membershipId: membership.id,
                },
              },
            })

            if (existingOtherNoteSheet) {
              await deleteOldNoteSheet(existingOtherNoteSheet)
            }
          }
        }

        const formData = await req.formData()
        const type = formData.get('type') as string

        if (type === 'CREATED') {
          const content = formData.get('content') as string
          if (!content) {
            return NextResponse.json(
              { error: 'Content is required for created note sheets' },
              { status: 400 }
            )
          }

          const noteSheet = await prisma.noteSheet.create({
            data: {
              esTestId: resolvedParams.testId,
              membershipId: membership.id,
              type: 'CREATED',
              content,
              status: initialStatus,
            },
            include: {
              membership: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          })

          // Copy note sheet to other tests in the same event
          if (esTest.eventId) {
            const otherESTests = await prisma.eSTest.findMany({
              where: {
                eventId: esTest.eventId,
                tournamentId: esTest.tournamentId,
                id: { not: resolvedParams.testId },
                allowNoteSheet: true,
                status: 'PUBLISHED',
              },
              select: {
                id: true,
              },
            })

            // Create note sheets for other tests in the same event
            for (const otherTest of otherESTests) {
              // Check if user already has a note sheet for this test
              const existingNoteSheet = await prisma.noteSheet.findUnique({
                where: {
                  esTestId_membershipId: {
                    esTestId: otherTest.id,
                    membershipId: membership.id,
                  },
                },
              })

              // Only create if one doesn't exist
              if (!existingNoteSheet) {
                await prisma.noteSheet.create({
                  data: {
                    esTestId: otherTest.id,
                    membershipId: membership.id,
                    type: 'CREATED',
                    content,
                    status: initialStatus,
                  },
                })
              }
            }
          }

          return NextResponse.json({ noteSheet })
        } else if (type === 'UPLOADED') {
          const file = formData.get('file') as File | null
          if (!file) {
            return NextResponse.json(
              { error: 'File is required for uploaded note sheets' },
              { status: 400 }
            )
          }

          // Validate PDF
          if (file.type !== 'application/pdf') {
            return NextResponse.json(
              { error: 'Only PDF files are allowed' },
              { status: 400 }
            )
          }

          // Validate file size
          if (file.size > MAX_PDF_SIZE) {
            return NextResponse.json(
              { error: 'File size exceeds 50MB limit' },
              { status: 400 }
            )
          }

          // Generate unique filename
          const timestamp = Date.now()
          const randomString = Math.random().toString(36).substring(2, 15)
          const extension = 'pdf'
          const filename = `note-sheet-${timestamp}-${randomString}.${extension}`

          // Create uploads directory if it doesn't exist
          const uploadsDir = join(process.cwd(), 'public', 'uploads', 'note-sheets')
          if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true })
          }

          // Save file
          const filePath = join(uploadsDir, filename)
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          await writeFile(filePath, buffer)

          const noteSheet = await prisma.noteSheet.create({
            data: {
              esTestId: resolvedParams.testId,
              membershipId: membership.id,
              type: 'UPLOADED',
              filePath: `/uploads/note-sheets/${filename}`,
              filename: file.name,
              fileSize: file.size,
              mimeType: file.type,
              status: initialStatus,
            },
            include: {
              membership: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          })

          // Copy note sheet to other tests in the same event
          if (esTest.eventId) {
            const otherESTests = await prisma.eSTest.findMany({
              where: {
                eventId: esTest.eventId,
                tournamentId: esTest.tournamentId,
                id: { not: resolvedParams.testId },
                allowNoteSheet: true,
                status: 'PUBLISHED',
              },
              select: {
                id: true,
              },
            })

            // Create note sheets for other tests in the same event (using same file)
            for (const otherTest of otherESTests) {
              // Check if user already has a note sheet for this test
              const existingNoteSheet = await prisma.noteSheet.findUnique({
                where: {
                  esTestId_membershipId: {
                    esTestId: otherTest.id,
                    membershipId: membership.id,
                  },
                },
              })

              // Only create if one doesn't exist
              if (!existingNoteSheet) {
                await prisma.noteSheet.create({
                  data: {
                    esTestId: otherTest.id,
                    membershipId: membership.id,
                    type: 'UPLOADED',
                    filePath: `/uploads/note-sheets/${filename}`, // Same file
                    filename: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    status: initialStatus,
                  },
                })
              }
            }
          }

          return NextResponse.json({ noteSheet })
        } else {
          return NextResponse.json(
            { error: 'Invalid type. Must be CREATED or UPLOADED' },
            { status: 400 }
          )
        }
      }
    }

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    await requireMember(session.user.id, test.clubId)

    const membership = await getUserMembership(session.user.id, test.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Check if note sheets are enabled for this test
    if (!test.allowNoteSheet) {
      return NextResponse.json(
        { error: 'Note sheets are not enabled for this test' },
        { status: 400 }
      )
    }

    // Check if test is scheduled (has startAt)
    if (!test.startAt) {
      return NextResponse.json(
        { error: 'Note sheets can only be created for scheduled tests' },
        { status: 400 }
      )
    }

    // Determine initial status based on autoApproveNoteSheet setting
    const initialStatus = test.autoApproveNoteSheet ? 'ACCEPTED' : 'PENDING'

    // Check if user already has a note sheet for this test
    const existingNoteSheet = await prisma.noteSheet.findUnique({
      where: {
        testId_membershipId: {
          testId: resolvedParams.testId,
          membershipId: membership.id,
        },
      },
    })

    // Helper function to delete old note sheet and its file
    const deleteOldNoteSheet = async (noteSheet: any) => {
      if (noteSheet.filePath) {
        try {
          const fs = require('fs')
          const path = require('path')
          const filePath = path.join(process.cwd(), 'public', noteSheet.filePath)
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
        } catch (err) {
          console.error('Failed to delete old note sheet file:', err)
        }
      }
      await prisma.noteSheet.delete({
        where: {
          id: noteSheet.id,
        },
      })
    }

    // If there's an existing note sheet, delete it to allow replacement
    if (existingNoteSheet) {
      await deleteOldNoteSheet(existingNoteSheet)
    }

    // Also delete note sheets for other tests in the same event (to replace them all)
    const eventAssignments = test.assignments.filter(a => a.eventId)
    if (eventAssignments.length > 0) {
      const eventIds = [...new Set(eventAssignments.map(a => a.eventId).filter((id): id is string => id !== null))]
      
      const otherTests = await prisma.test.findMany({
        where: {
          clubId: test.clubId,
          id: { not: resolvedParams.testId },
          allowNoteSheet: true,
          status: 'PUBLISHED',
          assignments: {
            some: {
              eventId: { in: eventIds },
            },
          },
        },
        select: {
          id: true,
        },
      })

      for (const otherTest of otherTests) {
        const existingOtherNoteSheet = await prisma.noteSheet.findUnique({
          where: {
            testId_membershipId: {
              testId: otherTest.id,
              membershipId: membership.id,
            },
          },
        })

        if (existingOtherNoteSheet) {
          await deleteOldNoteSheet(existingOtherNoteSheet)
        }
      }
    }

    const formData = await req.formData()
    const type = formData.get('type') as string

    if (type === 'CREATED') {
      const content = formData.get('content') as string
      if (!content) {
        return NextResponse.json(
          { error: 'Content is required for created note sheets' },
          { status: 400 }
        )
      }

          const noteSheet = await prisma.noteSheet.create({
            data: {
              testId: resolvedParams.testId, // For regular Test
              esTestId: null, // Not an ESTest
              membershipId: membership.id,
              type: 'CREATED',
              content,
              status: initialStatus,
            },
        include: {
          membership: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      })

          // Copy note sheet to other tests in the same event (if test is assigned to an event)
          const eventAssignments = test.assignments.filter(a => a.eventId)
          if (eventAssignments.length > 0) {
            const eventIds = [...new Set(eventAssignments.map(a => a.eventId).filter((id): id is string => id !== null))]
            
            // Find other tests assigned to the same events
            const otherTests = await prisma.test.findMany({
              where: {
                clubId: test.clubId,
                id: { not: resolvedParams.testId },
                allowNoteSheet: true,
                status: 'PUBLISHED',
                assignments: {
                  some: {
                    eventId: { in: eventIds },
                  },
                },
              },
              select: {
                id: true,
              },
            })

            // Create note sheets for other tests in the same events
            for (const otherTest of otherTests) {
              // Check if user already has a note sheet for this test
              const existingNoteSheet = await prisma.noteSheet.findUnique({
                where: {
                  testId_membershipId: {
                    testId: otherTest.id,
                    membershipId: membership.id,
                  },
                },
              })

              // Only create if one doesn't exist
              if (!existingNoteSheet) {
                await prisma.noteSheet.create({
                  data: {
                    testId: otherTest.id,
                    esTestId: null,
                    membershipId: membership.id,
                    type: 'CREATED',
                    content,
                    status: initialStatus,
                  },
                })
              }
            }
          }

      return NextResponse.json({ noteSheet })
    } else if (type === 'UPLOADED') {
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json(
          { error: 'File is required for uploaded note sheets' },
          { status: 400 }
        )
      }

      // Validate PDF
      if (file.type !== 'application/pdf') {
        return NextResponse.json(
          { error: 'Only PDF files are allowed' },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > MAX_PDF_SIZE) {
        return NextResponse.json(
          { error: 'File size exceeds 50MB limit' },
          { status: 400 }
        )
      }

      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const extension = 'pdf'
      const filename = `note-sheet-${timestamp}-${randomString}.${extension}`

      // Create uploads directory if it doesn't exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'note-sheets')
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // Save file
      const filePath = join(uploadsDir, filename)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      const noteSheet = await prisma.noteSheet.create({
        data: {
          testId: resolvedParams.testId, // For regular Test
          esTestId: null, // Not an ESTest
          membershipId: membership.id,
          type: 'UPLOADED',
          filePath: `/uploads/note-sheets/${filename}`,
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          status: initialStatus,
        },
        include: {
          membership: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      })

          // Copy note sheet to other tests in the same event (if test is assigned to an event)
          const eventAssignments = test.assignments.filter(a => a.eventId)
          if (eventAssignments.length > 0) {
            const eventIds = [...new Set(eventAssignments.map(a => a.eventId).filter((id): id is string => id !== null))]
            
            // Find other tests assigned to the same events
            const otherTests = await prisma.test.findMany({
              where: {
                clubId: test.clubId,
                id: { not: resolvedParams.testId },
                allowNoteSheet: true,
                status: 'PUBLISHED',
                assignments: {
                  some: {
                    eventId: { in: eventIds },
                  },
                },
              },
              select: {
                id: true,
              },
            })

            // Create note sheets for other tests in the same events (using same file)
            for (const otherTest of otherTests) {
              // Check if user already has a note sheet for this test
              const existingNoteSheet = await prisma.noteSheet.findUnique({
                where: {
                  testId_membershipId: {
                    testId: otherTest.id,
                    membershipId: membership.id,
                  },
                },
              })

              // Only create if one doesn't exist
              if (!existingNoteSheet) {
                await prisma.noteSheet.create({
                  data: {
                    testId: otherTest.id,
                    esTestId: null,
                    membershipId: membership.id,
                    type: 'UPLOADED',
                    filePath: `/uploads/note-sheets/${filename}`, // Same file
                    filename: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    status: initialStatus,
                  },
                })
              }
            }
          }

      return NextResponse.json({ noteSheet })
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be CREATED or UPLOADED' },
        { status: 400 }
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Create note sheet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get user's note sheet for a test
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const adminView = searchParams.get('admin') === 'true'

    // First try to find as regular Test
    let test = await prisma.test.findUnique({
      where: { id: resolvedParams.testId },
      include: {
        club: true,
      },
    })

    // If not found, check if it's an ESTest
    let esTest = null
    if (!test) {
      esTest = await prisma.eSTest.findUnique({
        where: { id: resolvedParams.testId },
        include: {
          tournament: {
            select: {
              id: true,
            },
          },
        },
      })

      if (esTest) {
        // Handle ESTest note sheets
        // Get user memberships to find their registered teams/clubs
        const userMemberships = await prisma.membership.findMany({
          where: {
            userId: session.user.id,
          },
          include: {
            club: {
              select: {
                id: true,
              },
            },
            team: {
              select: {
                id: true,
              },
            },
          },
        })

        // Get team IDs and club IDs from memberships
        const teamIds = userMemberships
          .map((m) => m.teamId)
          .filter((id): id is string => id !== null)
        const clubIds = userMemberships.map((m) => m.clubId)

        // Check if user is registered for this tournament
        const registration = await prisma.tournamentRegistration.findFirst({
          where: {
            tournamentId: esTest.tournamentId,
            status: 'CONFIRMED',
            OR: [
              { teamId: { in: teamIds } },
              { clubId: { in: clubIds } },
            ],
          },
        })

        if (!registration) {
          return NextResponse.json({ noteSheet: null })
        }

        // Find the membership that matches this registration
        const membership = registration.teamId
          ? userMemberships.find(
              (m) => m.clubId === registration.clubId && m.teamId === registration.teamId
            )
          : userMemberships.find((m) => m.clubId === registration.clubId)

        if (!membership) {
          return NextResponse.json({ noteSheet: null })
        }

        if (adminView) {
          // Admin view - get all note sheets for this ESTest
          // Check if user is tournament staff
          const tournamentStaff = await prisma.tournamentStaff.findFirst({
            where: {
              tournamentId: esTest.tournamentId,
              userId: session.user.id,
            },
          })
          
          if (!tournamentStaff) {
            return NextResponse.json(
              { error: 'Only tournament staff can view all note sheets' },
              { status: 403 }
            )
          }

          const noteSheets = await prisma.noteSheet.findMany({
            where: {
              esTestId: resolvedParams.testId,
            },
            include: {
              membership: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              reviewer: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          })

          return NextResponse.json({ noteSheets })
        } else {
          // User view - get their own note sheet
          const noteSheet = await prisma.noteSheet.findUnique({
            where: {
              esTestId_membershipId: {
                esTestId: resolvedParams.testId,
                membershipId: membership.id,
              },
            },
            include: {
              reviewer: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          })

          return NextResponse.json({ noteSheet })
        }
      }
    }

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    await requireMember(session.user.id, test.clubId)

    const membership = await getUserMembership(session.user.id, test.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    if (adminView) {
      // Admin view - get all note sheets for this test
      const isAdminUser = await isAdmin(session.user.id, test.clubId)
      if (!isAdminUser) {
        return NextResponse.json(
          { error: 'Only admins can view all note sheets' },
          { status: 403 }
        )
      }

      const noteSheets = await prisma.noteSheet.findMany({
        where: {
          testId: resolvedParams.testId,
        },
        include: {
          membership: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          reviewer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return NextResponse.json({ noteSheets })
    } else {
      // User view - get their own note sheet
      const noteSheet = await prisma.noteSheet.findUnique({
        where: {
          testId_membershipId: {
            testId: resolvedParams.testId,
            membershipId: membership.id,
          },
        },
        include: {
          reviewer: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      })

      return NextResponse.json({ noteSheet })
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get note sheet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

