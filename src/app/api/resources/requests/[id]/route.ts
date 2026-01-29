import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Approve or reject a resource request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, rejectionReason, editedName, editedTag, editedUrl } = body

    if (!['approve', 'reject', 'reset'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve", "reject", or "reset"' },
        { status: 400 }
      )
    }

    const request = await prisma.resourceRequest.findUnique({
      where: { id },
    })

    if (!request) {
      return NextResponse.json({ error: 'Resource request not found' }, { status: 404 })
    }

    // Handle reset action - can reset approved or rejected requests back to pending
    if (action === 'reset') {
      if (request.status === 'PENDING') {
        return NextResponse.json(
          { error: 'Resource request is already pending' },
          { status: 400 }
        )
      }

      await prisma.$transaction(async (tx) => {
        // If it was approved, the resource is now PUBLIC - convert it back to CLUB
        if (request.status === 'APPROVED') {
          const publicResource = await tx.resource.findFirst({
            where: {
              name: request.name,
              tag: request.tag,
              category: request.category,
              scope: 'PUBLIC',
            },
          })

          if (publicResource) {
            // Convert back to CLUB-scoped resource
            await tx.resource.update({
              where: { id: publicResource.id },
              data: {
                scope: 'CLUB',
                clubId: request.clubId,
              },
            })
          } else {
            // Create a CLUB-scoped resource if it doesn't exist
            await tx.resource.create({
              data: {
                name: request.name,
                tag: request.tag,
                url: request.url,
                category: request.category,
                scope: 'CLUB',
                clubId: request.clubId,
              },
            })
          }
        } else if (request.status === 'REJECTED') {
          // If it was rejected, recreate the CLUB-scoped resource
          await tx.resource.create({
            data: {
              name: request.name,
              tag: request.tag,
              url: request.url,
              category: request.category,
              scope: 'CLUB',
              clubId: request.clubId,
            },
          })
        }

        // Reset the request status to PENDING
        await tx.resourceRequest.update({
          where: { id },
          data: {
            status: 'PENDING',
            rejectionReason: null,
            reviewedAt: null,
          },
        })
      })

      return NextResponse.json({ success: true, message: 'Resource request reset to pending' })
    }

    // For approve/reject, request must be PENDING
    if (request.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Resource request has already been processed' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      // Use edited values if provided, otherwise fall back to original values
      const finalName = editedName || request.name
      const finalTag = editedTag || request.tag
      const finalUrl = editedUrl !== undefined ? editedUrl : request.url

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
        // Upgrade the existing resource to PUBLIC scope with edited values
        await prisma.$transaction(async (tx) => {
          // Update the resource to PUBLIC with edited values
          await tx.resource.update({
            where: { id: existingResource.id },
            data: {
              name: finalName,
              tag: finalTag,
              url: finalUrl,
              scope: 'PUBLIC',
              clubId: null, // Public resources are not tied to a specific club
            },
          })

          // Update the request status and store edited values
          await tx.resourceRequest.update({
            where: { id },
            data: {
              name: finalName,
              tag: finalTag,
              url: finalUrl,
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
              name: finalName,
              tag: finalTag,
              url: finalUrl,
              category: request.category,
              scope: 'PUBLIC',
              clubId: null,
            },
          })

          await tx.resourceRequest.update({
            where: { id },
            data: {
              name: finalName,
              tag: finalTag,
              url: finalUrl,
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

      // When rejecting, keep the CLUB-scoped resource so the club can still use it
      // Only update the request status - the resource remains visible to the club
      await prisma.resourceRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason,
          reviewedAt: new Date(),
        },
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
  const resolvedParams = await params
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

    // Delete the associated resource based on the request status
    await prisma.$transaction(async (tx) => {
      if (request.status === 'APPROVED') {
        // If approved, the resource was upgraded to PUBLIC scope with clubId=null
        const publicResource = await tx.resource.findFirst({
          where: {
            name: request.name,
            tag: request.tag,
            category: request.category,
            scope: 'PUBLIC',
          },
        })

        if (publicResource) {
          await tx.resource.delete({
            where: { id: publicResource.id },
          })
        }
      } else {
        // If pending or rejected, look for CLUB-scoped resource
        const clubResource = await tx.resource.findFirst({
          where: {
            name: request.name,
            category: request.category,
            clubId: request.clubId,
            scope: 'CLUB',
          },
        })

        if (clubResource) {
          await tx.resource.delete({
            where: { id: clubResource.id },
          })
        }
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
