import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireDevAccess } from '@/lib/dev/guard'

// GET - Fetch the email whitelist
export async function GET(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/email-whitelist')
  if (!guard.allowed) return guard.response

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'dev_panel_email_whitelist' },
    })

    let emails: string[] = []
    if (setting) {
      try {
        emails = JSON.parse(setting.value)
        if (!Array.isArray(emails)) {
          emails = []
        }
      } catch (_e) {
        emails = []
      }
    }

    // If empty, return default emails from environment variable
    if (emails.length === 0) {
      const defaultEmailsEnv = process.env.DEV_PANEL_DEFAULT_EMAILS
      if (defaultEmailsEnv) {
        emails = defaultEmailsEnv
          .split(',')
          .map(email => email.trim().toLowerCase())
          .filter(email => email.length > 0 && email.includes('@'))
      }
    }

    // Fetch user info for each email
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: emails,
        },
      },
      select: {
        email: true,
        name: true,
        image: true,
      },
    })

    // Create a map of email -> user info
    const userMap = new Map(users.map(user => [user.email.toLowerCase(), user]))

    // Combine emails with user info
    const emailsWithUsers = emails.map(email => {
      const user = userMap.get(email.toLowerCase())
      return {
        email,
        name: user?.name || null,
        image: user?.image || null,
      }
    })

    return NextResponse.json({ emails: emailsWithUsers })
  } catch (error) {
    console.error('Failed to fetch email whitelist:', error)
    return NextResponse.json({ error: 'Failed to fetch whitelist' }, { status: 500 })
  }
}

// PUT - Update the email whitelist
export async function PUT(request: NextRequest) {
  const guard = await requireDevAccess(request, '/api/dev/email-whitelist')
  if (!guard.allowed) return guard.response

  try {
    const body = await request.json()
    const { emails } = body

    if (!Array.isArray(emails)) {
      return NextResponse.json({ error: 'emails must be an array' }, { status: 400 })
    }

    // Validate all emails are strings
    if (!emails.every((email) => typeof email === 'string' && email.includes('@'))) {
      return NextResponse.json({ error: 'All emails must be valid email addresses' }, { status: 400 })
    }

    // Normalize emails (trim and lowercase)
    const normalizedEmails = emails
      .map((email: string) => email.toLowerCase().trim())
      .filter((email: string) => email.length > 0)

    // Remove duplicates
    const uniqueEmails = Array.from(new Set(normalizedEmails))

    // Upsert the setting
    const _setting = await prisma.siteSetting.upsert({
      where: { key: 'dev_panel_email_whitelist' },
      update: { value: JSON.stringify(uniqueEmails) },
      create: {
        key: 'dev_panel_email_whitelist',
        value: JSON.stringify(uniqueEmails),
      },
    })

    return NextResponse.json({ success: true, emails: uniqueEmails })
  } catch (error) {
    console.error('Failed to update email whitelist:', error)
    return NextResponse.json({ error: 'Failed to update whitelist' }, { status: 500 })
  }
}

