import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireMember, getUserMembership, isAdmin } from '@/lib/rbac'
import { z } from 'zod'

const updateTodoSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  completed: z.boolean().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional().nullable(),
})

// GET /api/todos/[todoId] - Get a single todo
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const { todoId } = resolvedParams

    const todo = await prisma.todo.findUnique({
      where: { id: todoId },
      include: {
        membership: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    await requireMember(session.user.id, todo.clubId)

    const membership = await getUserMembership(session.user.id, todo.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const isAdminUser = await isAdmin(session.user.id, todo.clubId)

    // Only owner or admin can view
    if (todo.membershipId !== membership.id && !isAdminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ todo })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Get todo error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/todos/[todoId] - Update a todo
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const { todoId } = resolvedParams

    const todo = await prisma.todo.findUnique({
      where: { id: todoId },
    })

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    await requireMember(session.user.id, todo.clubId)

    const membership = await getUserMembership(session.user.id, todo.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const isAdminUser = await isAdmin(session.user.id, todo.clubId)

    // Only owner or admin can update
    if (todo.membershipId !== membership.id && !isAdminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validated = updateTodoSchema.parse(body)

    // Handle completion timestamp
    const updateData: Record<string, unknown> = {
      ...validated,
      dueDate: validated.dueDate === null ? null : validated.dueDate ? new Date(validated.dueDate) : undefined,
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })

    // Set completedAt when marking as complete
    if (validated.completed === true && !todo.completed) {
      updateData.completedAt = new Date()
    } else if (validated.completed === false && todo.completed) {
      updateData.completedAt = null
    }

    const updatedTodo = await prisma.todo.update({
      where: { id: todoId },
      data: updateData,
      include: {
        membership: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ todo: updatedTodo })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Update todo error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/todos/[todoId] - Delete a todo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    const { todoId } = resolvedParams

    const todo = await prisma.todo.findUnique({
      where: { id: todoId },
    })

    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    await requireMember(session.user.id, todo.clubId)

    const membership = await getUserMembership(session.user.id, todo.clubId)
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const isAdminUser = await isAdmin(session.user.id, todo.clubId)

    // Only owner or admin can delete
    if (todo.membershipId !== membership.id && !isAdminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.todo.delete({
      where: { id: todoId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    console.error('Delete todo error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

