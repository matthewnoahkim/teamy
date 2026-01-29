import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE a resource (admin only, resources associated with the club)
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

    // Find the resource
    const resource = await prisma.resource.findUnique({
      where: { id },
    })

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }

    if (!resource.clubId) {
      return NextResponse.json(
        { error: 'Resource has no associated club' },
        { status: 400 }
      )
    }

    // Check if user is admin of the club
    const membership = await prisma.membership.findUnique({
      where: {
        userId_clubId: {
          userId: session.user.id,
          clubId: resource.clubId,
        },
      },
    })

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only admins can delete resources' },
        { status: 403 }
      )
    }

    // Delete the resource
    await prisma.resource.delete({
      where: { id },
    })

    // Also delete any pending resource request for this resource
    await prisma.resourceRequest.deleteMany({
      where: {
        name: resource.name,
        category: resource.category,
        clubId: resource.clubId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting resource:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete resource' },
      { status: 500 }
    )
  }
}

