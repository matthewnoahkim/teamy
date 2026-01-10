import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limit-api'
import { demoRequestSchema, validateRequestBody } from '@/lib/validation-schemas'
import { getValidatedWebhook } from '@/lib/security-config'

/**
 * Demo Request API Endpoint
 * 
 * SECURITY MEASURES:
 * - Rate limited to 5 requests per minute per IP (prevents spam/abuse)
 * - Strict input validation with Zod schemas
 * - Input sanitization to prevent injection attacks
 * - Webhook URL stored in environment variables
 * - Email validation to ensure valid format
 */

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate and sanitize input
    const validation = validateRequestBody(body, demoRequestSchema)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      )
    }

    const { email, schoolName } = validation.data

    // Get validated webhook URL from environment
    const webhookUrl = getValidatedWebhook('DEMO')

    if (!webhookUrl) {
      console.error('Demo webhook URL not configured or invalid')
      // Return success to user but log error
      return NextResponse.json({ 
        success: true,
        message: 'Thank you! We will contact you soon to schedule a demo.' 
      })
    }

    // Create Discord embed message
    const discordPayload = {
      embeds: [
        {
          title: 'New Demo Request',
          color: 0x0056C7, // Teamy primary blue
          fields: [
            {
              name: 'Email',
              value: email,
              inline: true,
            },
            {
              name: 'School Name',
              value: schoolName,
              inline: true,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Teamy Demo Request',
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
      // Still return success to user
    }

    return NextResponse.json({ 
      success: true,
      message: 'Thank you! We will contact you soon to schedule a demo.' 
    })
  } catch (error) {
    console.error('Demo request error:', error)
    return NextResponse.json(
      { error: 'An error occurred while processing your request. Please try again later.' },
      { status: 500 }
    )
  }
}

// Apply rate limiting: 5 requests per minute to prevent spam
export const POST = withRateLimit(handlePOST, {
  limit: 5,
  window: 60,
  identifier: 'demo request',
})
