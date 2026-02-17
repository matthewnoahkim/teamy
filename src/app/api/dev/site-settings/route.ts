import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { requireDevAccess } from '@/lib/dev/guard'

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
})

// Keys that may be read by unauthenticated clients (e.g. public banner on landing page)
const PUBLIC_READ_KEYS = new Set([
  'banner_enabled',
  'banner_text',
  'banner_link',
  'banner_background_color',
])

// GET - Fetch all site settings or a specific setting. Public read only for PUBLIC_READ_KEYS.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key && PUBLIC_READ_KEYS.has(key)) {
      const setting = await prisma.siteSetting.findUnique({
        where: { key },
      })
      return NextResponse.json({ setting })
    }

    // Listing all settings or reading any other key requires dev access
    const guard = await requireDevAccess(request, '/api/dev/site-settings')
    if (!guard.allowed) return guard.response

    if (key) {
      const setting = await prisma.siteSetting.findUnique({
        where: { key },
      })
      return NextResponse.json({ setting })
    }

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
export async function POST(request: NextRequest) {
  try {
    const guard = await requireDevAccess(request, '/api/dev/site-settings')
    if (!guard.allowed) return guard.response

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
export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireDevAccess(request, '/api/dev/site-settings')
    if (!guard.allowed) return guard.response

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

