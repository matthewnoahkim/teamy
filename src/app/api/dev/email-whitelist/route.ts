import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch the email whitelist
export async function GET(_request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is in whitelist (dev access check)
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

    // Verify requesting user has dev panel access
    const userEmail = session.user.email.toLowerCase().trim()
    const isAllowed = emails.some(
      (email) => email.toLowerCase().trim() === userEmail
    )
    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is in whitelist before allowing updates
    const currentSetting = await prisma.siteSetting.findUnique({
      where: { key: 'dev_panel_email_whitelist' },
    })

    let currentWhitelist: string[] = []
    if (currentSetting) {
      try {
        currentWhitelist = JSON.parse(currentSetting.value)
        if (!Array.isArray(currentWhitelist)) {
          currentWhitelist = []
        }
      } catch (_e) {
        currentWhitelist = []
      }
    }

    // If empty, use defaults from environment variable
    if (currentWhitelist.length === 0) {
      const defaultEmailsEnv = process.env.DEV_PANEL_DEFAULT_EMAILS
      if (defaultEmailsEnv) {
        currentWhitelist = defaultEmailsEnv
          .split(',')
          .map(email => email.trim().toLowerCase())
          .filter(email => email.length > 0 && email.includes('@'))
      }
    }

    const userEmail = session.user.email.toLowerCase().trim()
    const isAllowed = currentWhitelist.some(
      (email) => email.toLowerCase().trim() === userEmail
    )

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

