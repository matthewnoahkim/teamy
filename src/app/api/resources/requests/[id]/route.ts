import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Approve or reject a resource request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, rejectionReason } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const request = await prisma.resourceRequest.findUnique({
      where: { id },
    })

    if (!request) {
      return NextResponse.json({ error: 'Resource request not found' }, { status: 404 })
    }

    if (request.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Resource request has already been processed' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Find the existing CLUB-scoped resource that was created when the request was submitted
      const existingResource = await prisma.resource.findFirst({
        where: {
          name: request.name,
          category: request.category,
          clubId: request.clubId,
          scope: 'CLUB',
        },
      })

      if (existingResource) {
        // Upgrade the existing resource to PUBLIC scope
        await prisma.$transaction(async (tx) => {
          // Update the resource to PUBLIC
          await tx.resource.update({
            where: { id: existingResource.id },
            data: {
              scope: 'PUBLIC',
              clubId: null, // Public resources are not tied to a specific club
            },
          })

          // Update the request status
          await tx.resourceRequest.update({
            where: { id },
            data: {
              status: 'APPROVED',
              reviewedAt: new Date(),
            },
          })
        })
      } else {
        // Fallback: Create a new PUBLIC resource if the original wasn't found
        // (This handles legacy requests or edge cases)
        await prisma.$transaction(async (tx) => {
          await tx.resource.create({
            data: {
              name: request.name,
              tag: request.tag,
              url: request.url,
              category: request.category,
              scope: 'PUBLIC',
              clubId: null,
            },
          })

          await tx.resourceRequest.update({
            where: { id },
            data: {
              status: 'APPROVED',
              reviewedAt: new Date(),
            },
          })
        })
      }

      return NextResponse.json({ success: true, message: 'Resource approved and made public' })
    } else {
      // Reject the request
      if (!rejectionReason) {
        return NextResponse.json(
          { error: 'Rejection reason is required' },
          { status: 400 }
        )
      }

      // When rejecting, also delete the CLUB-scoped resource
      await prisma.$transaction(async (tx) => {
        // Find and delete the CLUB-scoped resource
        const existingResource = await tx.resource.findFirst({
          where: {
            name: request.name,
            category: request.category,
            clubId: request.clubId,
            scope: 'CLUB',
          },
        })

        if (existingResource) {
          await tx.resource.delete({
            where: { id: existingResource.id },
          })
        }

        // Update the request status
        await tx.resourceRequest.update({
          where: { id },
          data: {
            status: 'REJECTED',
            rejectionReason,
            reviewedAt: new Date(),
          },
        })
      })

      return NextResponse.json({ success: true, message: 'Resource request rejected' })
    }
  } catch (error: any) {
    console.error('Error processing resource request:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process resource request' },
      { status: 500 }
    )
  }
}

// Delete a resource request
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const request = await prisma.resourceRequest.findUnique({
      where: { id },
    })

    if (!request) {
      return NextResponse.json({ error: 'Resource request not found' }, { status: 404 })
    }

    // Also delete the associated CLUB-scoped resource if it exists
    await prisma.$transaction(async (tx) => {
      const existingResource = await tx.resource.findFirst({
        where: {
          name: request.name,
          category: request.category,
          clubId: request.clubId,
          scope: 'CLUB',
        },
      })

      if (existingResource) {
        await tx.resource.delete({
          where: { id: existingResource.id },
        })
      }

      await tx.resourceRequest.delete({
        where: { id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting resource request:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete resource request' },
      { status: 500 }
    )
  }
}
