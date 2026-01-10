import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit-api'
import { contactFormSchema, validateRequestBody } from '@/lib/validation-schemas'
import { getValidatedWebhook } from '@/lib/security-config'

/**
 * Contact Form API Endpoint
 * 
 * SECURITY MEASURES:
 * - Rate limited to 5 requests per minute per IP (prevents spam)
 * - Strict input validation with Zod schemas
 * - Input sanitization to prevent injection attacks
 * - Webhook URL stored in environment variables
 * - Error messages don't expose internal details
 */

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate and sanitize input
    const validation = validateRequestBody(body, contactFormSchema)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      )
    }
    
    const { name, email, subject, message } = validation.data
    
    // Get validated webhook URL from environment
    const webhookUrl = getValidatedWebhook('CONTACT')
    
    if (!webhookUrl) {
      console.error('Contact webhook URL not configured or invalid')
      // Return success to user but log error - don't expose internal config issues
      return NextResponse.json({ 
        success: true,
        message: 'Your message has been received. We will get back to you soon.' 
      })
    }

    // Create Discord embed message
    const discordPayload = {
      embeds: [
        {
          title: 'New Contact Form Submission',
          color: 0x0056C7, // Teamy primary blue
          fields: [
            {
              name: 'Name',
              value: name,
              inline: true,
            },
            {
              name: 'Email',
              value: email,
              inline: true,
            },
            {
              name: 'Subject',
              value: subject,
              inline: false,
            },
            {
              name: 'Message',
              value: message.length > 1024 ? message.substring(0, 1021) + '...' : message,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Teamy Contact Form',
          },
        },
      ],
    }

    // Send to Discord webhook
    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordPayload),
    })

    if (!discordResponse.ok) {
      console.error('Discord webhook failed:', await discordResponse.text())
      // Still return success to user - notification failure shouldn't block submission
    }

    return NextResponse.json({ 
      success: true,
      message: 'Thank you for contacting us. We will respond soon!' 
    })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'An error occurred while processing your request. Please try again later.' },
      { status: 500 }
    )
  }
}

// Apply rate limiting: 5 requests per minute to prevent spam
// This is a public endpoint, so rate limiting is critical
export const POST = withRateLimit(handlePOST, {
  limit: 5,
  window: 60,
  identifier: 'contact form',
})
