import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limit-api'
import { grantApplicationSchema, validateRequestBody } from '@/lib/validation-schemas'
import { getValidatedWebhook } from '@/lib/security-config'

/**
 * Grant Application API Endpoint
 * 
 * SECURITY MEASURES:
 * - Rate limited to 3 requests per hour per IP (prevents abuse)
 * - Comprehensive input validation with Zod schemas
 * - Input sanitization to prevent injection attacks
 * - Webhook URL stored in environment variables
 * - Email confirmation validation
 * - Role-based field requirements (coach info for officers)
 * 
 * IMPORTANT: Grant applications contain sensitive financial information
 */

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate and sanitize all input fields
    const validation = validateRequestBody(body, grantApplicationSchema)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      )
    }

    const data = validation.data
    
    // Get validated webhook URL from environment
    const webhookUrl = getValidatedWebhook('GRANTS')
    
    if (!webhookUrl) {
      console.error('Grants webhook URL not configured or invalid')
      // Still return success - don't expose configuration issues
      return NextResponse.json({ 
        success: true,
        message: 'Your grant application has been received. We will review it and get back to you soon.' 
      })
    }

    // Send Discord webhook notification
    if (webhookUrl) {
      const contactInfo = data.contactRole === 'coach' 
        ? `Coach: ${data.applicantName} (${data.applicantEmail})`
        : `Officer/Captain: ${data.applicantName} (${data.applicantEmail})\nCoach: ${data.coachName} (${data.coachEmail})`

      const embed = {
        title: 'New Grant Application',
        color: 0x0056C7,
        fields: [
          {
            name: 'Club Information',
            value: `Club: ${data.clubName}\nSchool: ${data.schoolName}\nAddress: ${data.schoolAddress}`,
            inline: false,
          },
          {
            name: 'Division',
            value: data.clubDivision,
            inline: true,
          },
          {
            name: 'Number of Teams',
            value: String(data.numberOfTeams),
            inline: true,
          },
          {
            name: 'Years in Science Olympiad',
            value: String(data.yearsParticipating),
            inline: true,
          },
          {
            name: 'Requested Amount',
            value: `$${data.grantAmount}`,
            inline: true,
          },
          {
            name: 'Club Description',
            value: data.clubDescription.substring(0, 1000) + (data.clubDescription.length > 1000 ? '...' : ''),
            inline: false,
          },
          {
            name: 'How Grant Would Benefit Team',
            value: data.grantBenefit.substring(0, 1000) + (data.grantBenefit.length > 1000 ? '...' : ''),
            inline: false,
          },
          ...(data.suggestions ? [{
            name: 'Suggestions for Teamy',
            value: data.suggestions.substring(0, 500) + (data.suggestions.length > 500 ? '...' : ''),
            inline: false,
          }] : []),
          {
            name: 'Contact Information',
            value: contactInfo,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      }

      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            embeds: [embed],
          }),
        })
      } catch (webhookError) {
        console.error('Failed to send Discord webhook:', webhookError)
        // Don't fail the request if webhook fails
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Your grant application has been received. We will review it and get back to you soon.' 
    })
  } catch (error) {
    console.error('Grant application error:', error)
    return NextResponse.json(
      { error: 'An error occurred while processing your application. Please try again later.' },
      { status: 500 }
    )
  }
}

// Apply rate limiting: 3 requests per hour to prevent spam (grants are infrequent)
export const POST = withRateLimit(handlePOST, {
  limit: 3,
  window: 3600, // 1 hour
  identifier: 'grant application',
})
