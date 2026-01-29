import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updatePageSchema = z.object({
  pageContent: z.string(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const resolvedParams = await params
  try {
    const hostingRequest = await prisma.tournamentHostingRequest.findUnique({
      where: { id: resolvedParams.requestId },
    })

    if (!hostingRequest) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      pageContent: hostingRequest.pageContent || null
    })
  } catch (error) {
    console.error('Error fetching tournament page:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find the hosting request
    const hostingRequest = await prisma.tournamentHostingRequest.findUnique({
      where: { id: resolvedParams.requestId },
    })

    if (!hostingRequest) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Verify user is the tournament director
    if (hostingRequest.directorEmail.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Only the tournament director can edit this page' },
        { status: 403 }
      )
    }

    // Verify tournament is approved
    if (hostingRequest.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved tournaments can be customized' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validatedData = updatePageSchema.parse(body)

    await prisma.tournamentHostingRequest.update({
      where: { id: resolvedParams.requestId },
      data: {
        pageContent: validatedData.pageContent,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating tournament page:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

