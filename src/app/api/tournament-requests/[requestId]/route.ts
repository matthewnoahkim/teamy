import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// PATCH - Update tournament hosting request status
// This endpoint is used by dev panel users to approve/reject tournament hosting requests
// Any authenticated user can update requests (dev panel access is controlled by the dev panel UI)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId } = resolvedParams
    const body = await request.json()
    const { status, reviewNotes } = body

    // Validate status
    if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Get the current request
    const currentRequest = await prisma.tournamentHostingRequest.findUnique({
      where: { id: requestId },
      include: { tournament: true },
    })

    if (!currentRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // If approving and no tournament exists yet, create one
    if (status === 'APPROVED' && !currentRequest.tournament) {
      // Generate a slug from the tournament name
      const baseSlug = currentRequest.preferredSlug || 
        currentRequest.tournamentName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      
      // Ensure slug is unique
      let slug = baseSlug
      let counter = 1
      while (await prisma.tournament.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`
        counter++
      }

      // Determine division - handle "B&C" case
      let division: 'B' | 'C' = 'C'
      if (currentRequest.division === 'B') {
        division = 'B'
      } else if (currentRequest.division === 'C') {
        division = 'C'
      }
      // For "B&C", default to C (can be changed later)

      // Create tournament and update request in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create the tournament
        const tournament = await tx.tournament.create({
          data: {
            name: currentRequest.tournamentName,
            slug,
            division,
            description: currentRequest.otherNotes,
            isOnline: currentRequest.tournamentFormat === 'satellite',
            startDate: new Date(), // Default to now, TD can update later
            endDate: new Date(),
            startTime: new Date(),
            endTime: new Date(),
            location: currentRequest.location,
            approved: true,
            createdById: session.user.id,
            hostingRequestId: requestId,
          },
        })

        // Find the director by email and add them as a tournament admin
        // This allows them to see and manage the tournament in the dev panel
        const director = await tx.user.findUnique({
          where: {
            email: currentRequest.directorEmail.toLowerCase(),
          },
        })

        if (director) {
          // Add director as tournament admin
          await tx.tournamentAdmin.create({
            data: {
              tournamentId: tournament.id,
              userId: director.id,
            },
          })
        }

        // Also add the approving user (dev panel user) as an admin if they're not already the creator
        // (They're already the creator, but let's make sure they're also an admin for consistency)
        await tx.tournamentAdmin.upsert({
          where: {
            tournamentId_userId: {
              tournamentId: tournament.id,
              userId: session.user.id,
            },
          },
          create: {
            tournamentId: tournament.id,
            userId: session.user.id,
          },
          update: {},
        })

        // Update the request status
        const updatedRequest = await tx.tournamentHostingRequest.update({
          where: { id: requestId },
          data: {
            status,
            reviewNotes: reviewNotes || null,
          },
          include: {
            tournament: true,
          },
        })

        return updatedRequest
      })

      return NextResponse.json({ 
        success: true, 
        request: result 
      })
    }

    // For non-approval or if tournament already exists, just update the status
    const updatedRequest = await prisma.tournamentHostingRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewNotes: reviewNotes || null,
      },
      include: {
        tournament: true,
      },
    })

    return NextResponse.json({ 
      success: true, 
      request: updatedRequest 
    })
  } catch (error) {
    console.error('Error updating tournament hosting request:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a tournament hosting request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const resolvedParams = await params
  try {
    const { requestId } = resolvedParams

    // First, find and delete any associated tournament
    const hostingRequest = await prisma.tournamentHostingRequest.findUnique({
      where: { id: requestId },
      include: { tournament: true },
    })

    if (hostingRequest?.tournament) {
      // Delete the tournament first (this will cascade delete related records)
      await prisma.tournament.delete({
        where: { id: hostingRequest.tournament.id },
      })
    }

    // Then delete the hosting request
    await prisma.tournamentHostingRequest.delete({
      where: { id: requestId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tournament hosting request:', error)
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    )
  }
}

