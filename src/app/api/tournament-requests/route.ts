import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1444884965656498297/cYFv5fCpclifIVFzyi4a6tN3a5u_hpGE2AZGfPCT8hyJkfo96hcCdcYmBL-YvG2LOjXU'

// POST - Submit a new tournament hosting request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tournamentName,
      tournamentLevel,
      division,
      tournamentFormat,
      location,
      preferredSlug,
      directorName,
      directorEmail,
      directorPhone,
      otherNotes,
    } = body

    // Validate required fields
    if (!tournamentName || !tournamentLevel || !division || !tournamentFormat || !directorName || !directorEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(directorEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Create the tournament hosting request
    const hostingRequest = await prisma.tournamentHostingRequest.create({
      data: {
        tournamentName,
        tournamentLevel,
        division,
        tournamentFormat,
        location: location || null,
        preferredSlug: preferredSlug || null,
        directorName,
        directorEmail,
        directorPhone: directorPhone || null,
        otherNotes: otherNotes || null,
      },
    })

    // Send to Discord webhook
    try {
      const formatLabel = tournamentFormat === 'in-person' ? 'In-Person' : tournamentFormat === 'satellite' ? 'Satellite' : 'Mini SO'
      const levelLabel = tournamentLevel.charAt(0).toUpperCase() + tournamentLevel.slice(1)
      
      const discordPayload = {
        embeds: [
          {
            title: 'New Tournament Hosting Request',
            color: 0x0056C7, // Teamy primary blue
            fields: [
              {
                name: 'Tournament Name',
                value: tournamentName,
                inline: false,
              },
              {
                name: 'Level',
                value: levelLabel,
                inline: true,
              },
              {
                name: 'Division',
                value: `Division ${division}`,
                inline: true,
              },
              {
                name: 'Format',
                value: formatLabel,
                inline: true,
              },
              ...(location ? [{
                name: 'Location',
                value: location,
                inline: false,
              }] : []),
              ...(preferredSlug ? [{
                name: 'Preferred Slug',
                value: `teamy.site/tournaments/${preferredSlug}`,
                inline: false,
              }] : []),
              {
                name: 'Director Name',
                value: directorName,
                inline: true,
              },
              {
                name: 'Director Email',
                value: directorEmail,
                inline: true,
              },
              ...(directorPhone ? [{
                name: 'Phone',
                value: directorPhone,
                inline: true,
              }] : []),
              ...(otherNotes ? [{
                name: 'Notes',
                value: otherNotes.length > 1024 ? otherNotes.substring(0, 1021) + '...' : otherNotes,
                inline: false,
              }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Teamy Tournament Request',
            },
          },
        ],
      }

      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discordPayload),
      })
      console.log('Discord webhook sent for tournament request:', tournamentName)
    } catch (webhookError) {
      // Log webhook error but don't fail the request
      console.error('Failed to send Discord webhook:', webhookError)
    }

    // Send confirmation email to the tournament director
    try {
      if (process.env.RESEND_API_KEY) {
        const baseUrl = process.env.NEXTAUTH_URL || 'https://teamy.site'
        
        await resend.emails.send({
          from: 'Teamy <no-reply@teamy.site>',
          to: [directorEmail],
          subject: `Tournament Hosting Request Received - ${tournamentName}`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #0056C7; margin: 0;">Teamy</h1>
                <p style="color: #6b7280; margin-top: 4px;">Tournament Management Platform</p>
              </div>
              
              <h2 style="color: #1f2937; margin-top: 0;">Tournament Hosting Request Received</h2>
              
              <p style="color: #374151; line-height: 1.6;">
                Hi ${directorName},
              </p>
              
              <p style="color: #374151; line-height: 1.6;">
                Thank you for your interest in hosting <strong>${tournamentName}</strong> on Teamy! 
                We have received your tournament hosting request and it is currently <strong>pending approval</strong>.
              </p>
              
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #92400e; margin: 0; font-weight: 500;">
                  ⏳ Your request is pending review
                </p>
                <p style="color: #92400e; margin: 8px 0 0 0; font-size: 14px;">
                  Our team will review your submission and get back to you within 2-3 business days.
                </p>
              </div>

              <div style="text-align: center; padding: 24px; background-color: #eff6ff; border-radius: 8px; margin: 24px 0;">
                <p style="color: #0056C7; font-weight: 500; margin: 0 0 12px 0;">
                  Track your request status anytime
                </p>
                <a href="${baseUrl}/td" style="display: inline-block; background-color: #0056C7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                  Visit TD Portal
                </a>
                <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0;">
                  Sign in with this email (${directorEmail}) to view your request status.
                </p>
              </div>
              
              <h3 style="color: #1f2937; margin-top: 32px;">Request Details</h3>
              <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; width: 140px;">Tournament Name:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${tournamentName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Level:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${tournamentLevel.charAt(0).toUpperCase() + tournamentLevel.slice(1)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Division:</td>
                    <td style="padding: 8px 0; color: #1f2937;">Division ${division}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Format:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${tournamentFormat === 'in-person' ? 'In-Person' : tournamentFormat === 'satellite' ? 'Satellite' : 'Mini SO'}</td>
                  </tr>
                  ${location ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Location:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${location}</td>
                  </tr>
                  ` : ''}
                  ${preferredSlug ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Preferred URL:</td>
                    <td style="padding: 8px 0; color: #1f2937;">teamy.site/tournaments/${preferredSlug}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              <p style="color: #374151; line-height: 1.6;">
                If you have any questions in the meantime, feel free to reply to this email or contact us at 
                <a href="mailto:support@teamy.site" style="color: #0056C7;">support@teamy.site</a>.
              </p>
              
              <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
              
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                Teamy • Science Olympiad Tournament Management Platform<br/>
                <a href="${baseUrl}" style="color: #6b7280;">teamy.site</a>
              </p>
            </div>
          `,
        })
        console.log('Confirmation email sent to:', directorEmail)
      }
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error('Failed to send confirmation email:', emailError)
    }

    return NextResponse.json({ 
      success: true, 
      requestId: hostingRequest.id 
    })
  } catch (error) {
    console.error('Error creating tournament hosting request:', error)
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    )
  }
}

// GET - Get all tournament hosting requests (for dev panel)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = {}

    if (status && status !== 'all') {
      where.status = status.toUpperCase()
    }

    if (search) {
      where.OR = [
        { tournamentName: { contains: search, mode: 'insensitive' } },
        { directorName: { contains: search, mode: 'insensitive' } },
        { directorEmail: { contains: search, mode: 'insensitive' } },
      ]
    }

    const requests = await prisma.tournamentHostingRequest.findMany({
      where,
      include: {
        tournament: {
          select: {
            id: true,
            published: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Return all requests - dev panel users should see all requests regardless of
    // whether they have tournaments or whether those tournaments are published
    // This allows developers to see and manage pending requests, approved requests,
    // and rejected requests
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching tournament hosting requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}

