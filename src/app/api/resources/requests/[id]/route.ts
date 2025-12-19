import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Approve or reject a resource request
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin (you may want to add a proper admin check)
    // For now, we'll allow any authenticated user to approve/reject
    // In production, you should add proper admin verification

    const body = await req.json()
    const { action, rejectionReason } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const request = await prisma.resourceRequest.findUnique({
      where: { id: params.id },
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
      // Create the resource
      const resource = await prisma.resource.create({
        data: {
          name: request.name,
          tag: request.tag,
          url: request.url,
          category: request.category,
          scope: 'PUBLIC',
          clubId: null, // Public resources are not tied to a specific club
        },
      })

      // Update the request status
      await prisma.resourceRequest.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      })

      return NextResponse.json({ resource, request })
    } else {
      // Reject the request
      if (!rejectionReason) {
        return NextResponse.json(
          { error: 'Rejection reason is required' },
          { status: 400 }
        )
      }

      await prisma.resourceRequest.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          rejectionReason,
          reviewedAt: new Date(),
        },
      })

      return NextResponse.json({ success: true })
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const request = await prisma.resourceRequest.findUnique({
      where: { id: params.id },
    })

    if (!request) {
      return NextResponse.json({ error: 'Resource request not found' }, { status: 404 })
    }

    await prisma.resourceRequest.delete({
      where: { id: params.id },
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
