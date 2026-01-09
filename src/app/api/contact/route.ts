import { NextRequest, NextResponse } from 'next/server'
import { sanitizeString } from '@/lib/input-validation'
import { z } from 'zod'

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1441856071911211228/fXL-cAc4oLN2flLH3W7nDcTGkupuKNvETf1ExSUqhSuCo8ZUrY5vovxIWQjY7qNBkRtf'

// Validation schema for contact form
const contactFormSchema = z.object({
  name: z.string().min(1).max(200).transform((val) => sanitizeString(val, 200)),
  email: z.string().email().max(255).transform((val) => sanitizeString(val, 255)),
  subject: z.string().min(1).max(200).transform((val) => sanitizeString(val, 200)),
  message: z.string().min(1).max(5000).transform((val) => sanitizeString(val, 5000)),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate and sanitize input using Zod
    const validationResult = contactFormSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }
    
    const { name, email, subject, message } = validationResult.data

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
    const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordPayload),
    })

    if (!discordResponse.ok) {
      console.error('Discord webhook failed:', await discordResponse.text())
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    )
  }
}

