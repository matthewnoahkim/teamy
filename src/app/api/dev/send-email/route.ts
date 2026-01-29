import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { subDays } from 'date-fns'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subject, htmlContent, filters } = body

    if (!subject || !htmlContent) {
      return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 })
    }

    if (!resend) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    // Build the where clause for filtering
    const where: any = {}
    
    if (filters.minMemberDays) {
      const minDate = subDays(new Date(), parseInt(filters.minMemberDays))
      where.createdAt = { ...where.createdAt, lte: minDate }
    }
    if (filters.maxMemberDays) {
      const maxDate = subDays(new Date(), parseInt(filters.maxMemberDays))
      where.createdAt = { ...where.createdAt, gte: maxDate }
    }

    // Get all matching users
    const allUsers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        memberships: {
          select: {
            role: true,
            club: { select: { id: true } },
          },
        },
        tournamentStaff: {
          select: {
            role: true,
          },
        },
      },
    })

    // Filter by additional criteria
    let filteredUsers = allUsers.map(user => {
      const clubCount = new Set(user.memberships.map(m => m.club.id)).size
      const isAdmin = user.memberships.some(m => m.role === 'ADMIN')
      const isTD = user.tournamentStaff.some(s => s.role === 'TOURNAMENT_DIRECTOR')
      const isES = user.tournamentStaff.some(s => s.role === 'EVENT_SUPERVISOR')
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        isClubAdmin: isAdmin,
        isTournamentDirector: isTD,
        isEventSupervisor: isES,
        clubCount,
      }
    })

    // Apply additional filters
    if (filters.minClubs) {
      filteredUsers = filteredUsers.filter(u => u.clubCount >= parseInt(filters.minClubs))
    }
    if (filters.isClubAdmin === 'true') {
      filteredUsers = filteredUsers.filter(u => u.isClubAdmin)
    } else if (filters.isClubAdmin === 'false') {
      filteredUsers = filteredUsers.filter(u => !u.isClubAdmin)
    }
    if (filters.isTournamentDirector === 'true') {
      filteredUsers = filteredUsers.filter(u => u.isTournamentDirector)
    } else if (filters.isTournamentDirector === 'false') {
      filteredUsers = filteredUsers.filter(u => !u.isTournamentDirector)
    }
    if (filters.isEventSupervisor === 'true') {
      filteredUsers = filteredUsers.filter(u => u.isEventSupervisor)
    } else if (filters.isEventSupervisor === 'false') {
      filteredUsers = filteredUsers.filter(u => !u.isEventSupervisor)
    }

    if (filteredUsers.length === 0) {
      return NextResponse.json({ error: 'No users match the specified filters' }, { status: 400 })
    }

    // Wrap user's HTML in email template
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: system-ui, -apple-system, sans-serif;">
  ${htmlContent}
  <div style="max-width: 600px; margin: 32px auto 0; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      Teamy • Science Olympiad Club Management
    </p>
  </div>
</body>
</html>
    `.trim()

    // Send emails in batches (Resend has rate limits)
    const batchSize = 50
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < filteredUsers.length; i += batchSize) {
      const batch = filteredUsers.slice(i, i + batchSize)
      
      const results = await Promise.allSettled(
        batch.map(user => 
          resend.emails.send({
            from: 'Teamy <no-reply@teamy.site>',
            to: user.email,
            subject,
            html: fullHtml,
          })
        )
      )

      results.forEach(result => {
        if (result.status === 'fulfilled' && !result.value.error) {
          successCount++
        } else {
          errorCount++
        }
      })

      // Small delay between batches to avoid rate limits
      if (i + batchSize < filteredUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`Bulk email sent: ${successCount} successful, ${errorCount} failed`)

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: errorCount,
      total: filteredUsers.length,
    })
  } catch (error) {
    console.error('Error sending bulk email:', error)
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 })
  }
}
