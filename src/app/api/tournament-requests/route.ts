import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { withRateLimit } from '@/lib/rate-limit-api'
import { tournamentRequestSchema, validateRequestBody } from '@/lib/validation-schemas'
import { getValidatedWebhook, EMAIL_CONFIG } from '@/lib/security-config'

/**
 * Tournament Hosting Request API Endpoint
 * 
 * SECURITY MEASURES:
 * - Rate limited to 3 requests per hour per IP
 * - Comprehensive input validation with Zod schemas
 * - Input sanitization to prevent injection attacks
 * - Webhook URL stored in environment variables
 * - Email confirmation validation
 * - Slug validation to prevent URL injection
 */

const resend = EMAIL_CONFIG.RESEND_API_KEY ? new Resend(EMAIL_CONFIG.RESEND_API_KEY) : null

// POST - Submit a new tournament hosting request
async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate and sanitize all input fields
    const validation = validateRequestBody(body, tournamentRequestSchema)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      )
    }

    const data = validation.data
    
    // If slug is provided, check if it's available
    if (data.preferredSlug) {
      const existingTournament = await prisma.tournament.findUnique({
        where: { slug: data.preferredSlug },
      })
      
      if (existingTournament) {
        return NextResponse.json(
          { error: 'This slug is already taken. Please choose another one.' },
          { status: 409 }
        )
      }
    }

    // Create the tournament hosting request
    const hostingRequest = await prisma.tournamentHostingRequest.create({
      data: {
        tournamentName: data.tournamentName,
        tournamentLevel: data.tournamentLevel,
        division: data.division,
        tournamentFormat: data.tournamentFormat,
        location: data.location || null,
        preferredSlug: data.preferredSlug || null,
        directorName: data.directorName,
        directorEmail: data.directorEmail,
        directorPhone: data.directorPhone || null,
        otherNotes: data.otherNotes || null,
      },
    })

    // Get validated webhook URL from environment
    const webhookUrl = getValidatedWebhook('TOURNAMENT_REQUEST')

    // Send to Discord webhook
    if (webhookUrl) {
      try {
        const formatLabel = data.tournamentFormat === 'in-person' ? 'In-Person' : data.tournamentFormat === 'satellite' ? 'Satellite' : 'Mini SO'
        const levelLabel = data.tournamentLevel.charAt(0).toUpperCase() + data.tournamentLevel.slice(1)
      
        const discordPayload = {
          embeds: [
            {
              title: 'New Tournament Hosting Request',
              color: 0x0056C7, // Teamy primary blue
              fields: [
                {
                  name: 'Tournament Name',
                  value: data.tournamentName,
                  inline: false,
                },
                {
                  name: 'Level',
                  value: levelLabel,
                  inline: true,
                },
                {
                  name: 'Division',
                  value: `Division ${data.division}`,
                  inline: true,
                },
                {
                  name: 'Format',
                  value: formatLabel,
                  inline: true,
                },
                ...(data.location ? [{
                  name: 'Location',
                  value: data.location,
                  inline: false,
                }] : []),
                ...(data.preferredSlug ? [{
                  name: 'Preferred Slug',
                  value: `teamy.site/tournaments/${data.preferredSlug}`,
                  inline: false,
                }] : []),
                {
                  name: 'Director Name',
                  value: data.directorName,
                  inline: true,
                },
                {
                  name: 'Director Email',
                  value: data.directorEmail,
                  inline: true,
                },
                ...(data.directorPhone ? [{
                  name: 'Phone',
                  value: data.directorPhone,
                  inline: true,
                }] : []),
                ...(data.otherNotes ? [{
                  name: 'Notes',
                  value: data.otherNotes.length > 1024 ? data.otherNotes.substring(0, 1021) + '...' : data.otherNotes,
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

        await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(discordPayload),
        })
        console.log('Discord webhook sent for tournament request:', data.tournamentName)
      } catch (webhookError) {
        // Log webhook error but don't fail the request
        console.error('Failed to send Discord webhook:', webhookError)
      }
    }

    // Send confirmation email to the tournament director
    try {
      if (resend && EMAIL_CONFIG.RESEND_API_KEY) {
        const baseUrl = process.env.NEXTAUTH_URL || 'https://teamy.site'
        
        await resend.emails.send({
          from: EMAIL_CONFIG.FROM_EMAIL,
          to: [data.directorEmail],
          subject: `Tournament Hosting Request Received - ${data.tournamentName}`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #0056C7; margin: 0;">Teamy</h1>
                <p style="color: #6b7280; margin-top: 4px;">Tournament Management Platform</p>
              </div>
              
              <h2 style="color: #1f2937; margin-top: 0;">Tournament Hosting Request Received</h2>
              
              <p style="color: #374151; line-height: 1.6;">
                Hi ${data.directorName},
              </p>
              
              <p style="color: #374151; line-height: 1.6;">
                Thank you for your interest in hosting <strong>${data.tournamentName}</strong> on Teamy! 
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
                  Sign in with this email (${data.directorEmail}) to view your request status.
                </p>
              </div>
              
              <h3 style="color: #1f2937; margin-top: 32px;">Request Details</h3>
              <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; width: 140px;">Tournament Name:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${data.tournamentName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Level:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${data.tournamentLevel.charAt(0).toUpperCase() + data.tournamentLevel.slice(1)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Division:</td>
                    <td style="padding: 8px 0; color: #1f2937;">Division ${data.division}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Format:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${data.tournamentFormat === 'in-person' ? 'In-Person' : data.tournamentFormat === 'satellite' ? 'Satellite' : 'Mini SO'}</td>
                  </tr>
                  ${data.location ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Location:</td>
                    <td style="padding: 8px 0; color: #1f2937;">${data.location}</td>
                  </tr>
                  ` : ''}
                  ${data.preferredSlug ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Preferred URL:</td>
                    <td style="padding: 8px 0; color: #1f2937;">teamy.site/tournaments/${data.preferredSlug}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              <p style="color: #374151; line-height: 1.6;">
                If you have any questions in the meantime, feel free to reply to this email or contact us at 
                <a href="mailto:teamysite@gmail.com" style="color: #0056C7;">teamysite@gmail.com</a>.
              </p>
              
              <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
              
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                Teamy • Science Olympiad Tournament Management Platform<br/>
                <a href="${baseUrl}" style="color: #6b7280;">teamy.site</a>
              </p>
            </div>
          `,
        })
        console.log('Confirmation email sent to:', data.directorEmail)
      }
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error('Failed to send confirmation email:', emailError)
    }

    return NextResponse.json({ 
      success: true, 
      requestId: hostingRequest.id,
      message: 'Your tournament hosting request has been submitted successfully!' 
    })
  } catch (error) {
    console.error('Error creating tournament hosting request:', error)
    return NextResponse.json(
      { error: 'An error occurred while submitting your request. Please try again later.' },
      { status: 500 }
    )
  }
}

// Apply rate limiting: 3 requests per hour per IP (tournaments are infrequent)
export const POST = withRateLimit(handlePOST, {
  limit: 3,
  window: 3600, // 1 hour
  identifier: 'tournament request',
})

// GET - Get all tournament hosting requests (for dev panel)
// Note: This should be protected by authentication middleware
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

