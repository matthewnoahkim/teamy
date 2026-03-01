import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'
import { withRateLimit } from '@/lib/rate-limit-api'
import { tournamentRequestSchema, validateRequestBody } from '@/lib/validation-schemas'
import { getValidatedWebhook, EMAIL_CONFIG } from '@/lib/security-config'
import { requireDevAccess } from '@/lib/dev/guard'
import { escapeHtml, renderTeamyEmailLayout } from '@/lib/email'

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
        const formatLabel =
          data.tournamentFormat === 'in-person'
            ? 'In-Person'
            : data.tournamentFormat === 'satellite'
            ? 'Satellite'
            : 'Mini SO'
        const levelLabel = data.tournamentLevel.charAt(0).toUpperCase() + data.tournamentLevel.slice(1)

        const bodyHtml = `
          <p style="margin:0 0 14px 0; color:#c6d5ee; font-size:15px; line-height:1.65;">
            Hi ${escapeHtml(data.directorName)},
          </p>
          <p style="margin:0 0 14px 0; color:#c6d5ee; font-size:15px; line-height:1.65;">
            We received your request for <strong style="color:#f3f7ff;">${escapeHtml(data.tournamentName)}</strong>. Status: <strong style="color:#f3f7ff;">Pending review</strong>.
          </p>
          <div style="background:#091329; border:1px solid #244a88; border-radius:12px; padding:14px 16px;">
            <p style="margin:0 0 8px 0; color:#f3f7ff; font-size:14px; font-weight:700;">Submitted details</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="padding:5px 0; color:#9bb0d1; font-size:13px; width:148px;">Tournament</td>
                <td style="padding:5px 0; color:#c6d5ee; font-size:13px;">${escapeHtml(data.tournamentName)}</td>
              </tr>
              <tr>
                <td style="padding:5px 0; color:#9bb0d1; font-size:13px;">Level</td>
                <td style="padding:5px 0; color:#c6d5ee; font-size:13px;">${escapeHtml(levelLabel)}</td>
              </tr>
              <tr>
                <td style="padding:5px 0; color:#9bb0d1; font-size:13px;">Division</td>
                <td style="padding:5px 0; color:#c6d5ee; font-size:13px;">Division ${escapeHtml(data.division)}</td>
              </tr>
              <tr>
                <td style="padding:5px 0; color:#9bb0d1; font-size:13px;">Format</td>
                <td style="padding:5px 0; color:#c6d5ee; font-size:13px;">${escapeHtml(formatLabel)}</td>
              </tr>
              ${data.location ? `
              <tr>
                <td style="padding:5px 0; color:#9bb0d1; font-size:13px;">Location</td>
                <td style="padding:5px 0; color:#c6d5ee; font-size:13px;">${escapeHtml(data.location)}</td>
              </tr>
              ` : ''}
              ${data.preferredSlug ? `
              <tr>
                <td style="padding:5px 0; color:#9bb0d1; font-size:13px;">Preferred URL</td>
                <td style="padding:5px 0; color:#c6d5ee; font-size:13px;">teamy.site/tournaments/${escapeHtml(data.preferredSlug)}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          <p style="margin:16px 0 0 0; color:#9bb0d1; font-size:13px; line-height:1.6;">
            Typical review time: 2-3 business days.
          </p>
        `

        const actionUrl = `${baseUrl}/td`
        const html = renderTeamyEmailLayout({
          preheader: `Tournament hosting request received for ${data.tournamentName}`,
          label: 'Tournament Request',
          title: 'Request Received',
          subtitle: data.tournamentName,
          bodyHtml,
          actionLabel: 'Open TD Portal',
          actionUrl,
          actionHintHtml: `
            <p style="margin:14px 0 0 0; color:#9bb0d1; font-size:12px; line-height:1.6; text-align:center;">
              Sign in with <strong style="color:#c6d5ee;">${escapeHtml(data.directorEmail)}</strong> to track your request.
            </p>
          `,
          footerText: 'Teamy • Science Olympiad Tournament Management Platform',
        })

        await resend.emails.send({
          from: EMAIL_CONFIG.FROM_EMAIL,
          to: [data.directorEmail],
          subject: `Tournament Hosting Request Received - ${data.tournamentName}`,
          html,
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

// GET - Public approved listings, plus full dev-panel access for all statuses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const normalizedStatus = status?.toUpperCase()

    // Allow public access only for approved listings without search.
    // All other request views are dev-panel-only and should not leak route/data.
    const isPublicApprovedListing = normalizedStatus === 'APPROVED' && !search
    if (!isPublicApprovedListing) {
      const guard = await requireDevAccess(request, '/api/tournament-requests')
      if (!guard.allowed) return guard.response
    }

    const where: Record<string, unknown> = {}

    if (status && status !== 'all') {
      where.status = normalizedStatus
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

    // Dev panel users can fetch all statuses; public requests only reach APPROVED listing mode.
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching tournament hosting requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}
