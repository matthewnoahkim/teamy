import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
})

// GET - Fetch all site settings or a specific setting
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key) {
      // Fetch a specific setting
      const setting = await prisma.siteSetting.findUnique({
        where: { key },
      })
      
      return NextResponse.json({ setting })
    }

    // Fetch all settings
    const settings = await prisma.siteSetting.findMany({
      orderBy: { key: 'asc' },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Failed to fetch site settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// POST/PUT - Create or update a site setting (dev only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is authenticated (dev panel has its own auth)
    // This endpoint should only be accessible from the dev panel
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = settingSchema.parse(body)

    // Upsert the setting
    const setting = await prisma.siteSetting.upsert({
      where: { key: validatedData.key },
      update: { value: validatedData.value },
      create: {
        key: validatedData.key,
        value: validatedData.value,
      },
    })

    return NextResponse.json({ success: true, setting })
  } catch (error) {
    console.error('Failed to update site setting:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}

// DELETE - Remove a site setting (dev only)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    await prisma.siteSetting.delete({
      where: { key },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete site setting:', error)
    return NextResponse.json({ error: 'Failed to delete setting' }, { status: 500 })
  }
}

