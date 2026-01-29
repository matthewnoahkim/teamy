import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/rbac'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'

const updateFormSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
})

// PATCH - Update form
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formId = resolvedParams.formId
    const body = await req.json()
    const validated = updateFormSchema.parse(body)

    // Find the form
    const existingForm = await prisma.form.findUnique({
      where: { id: formId },
    })

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Only admins can update forms
    const isAdminUser = await isAdmin(session.user.id, existingForm.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can update forms' },
        { status: 403 }
      )
    }

    const form = await prisma.form.update({
      where: { id: formId },
      data: {
        ...validated,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      },
      include: {
        submissions: true,
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    })

    return NextResponse.json({ form })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid data', 
        details: error.issues 
      }, { status: 400 })
    }
    console.error('Update form error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete form
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const resolvedParams = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formId = resolvedParams.formId

    // Find the form
    const existingForm = await prisma.form.findUnique({
      where: { id: formId },
    })

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Only admins can delete forms
    const isAdminUser = await isAdmin(session.user.id, existingForm.clubId)
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Only admins can delete forms' },
        { status: 403 }
      )
    }

    // Delete file from filesystem
    try {
      const filePath = join(process.cwd(), 'public', existingForm.filePath)
      await unlink(filePath)
    } catch (err) {
      console.error('Failed to delete file:', err)
      // Continue even if file deletion fails
    }

    // Delete from database (submissions will be deleted via CASCADE)
    await prisma.form.delete({
      where: { id: formId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete form error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

