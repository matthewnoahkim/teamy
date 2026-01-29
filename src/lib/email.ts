import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

/**
 * Get the base URL for the app.
 * Uses NEXTAUTH_URL if set, otherwise VERCEL_URL for production, or localhost for development.
 */
function getBaseUrl(): string {
  // First priority: explicitly set NEXTAUTH_URL
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  // Second priority: Vercel deployment URL (automatically set by Vercel)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Third priority: custom APP_URL env var
  if (process.env.APP_URL) {
    return process.env.APP_URL
  }
  // Production fallback
  if (process.env.NODE_ENV === 'production') {
    return 'https://teamy.site'
  }
  // Development fallback
  return 'http://localhost:3000'
}

export interface StaffInviteEmailParams {
  to: string
  staffName?: string
  tournamentName: string
  role: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
  inviteToken: string
  inviterName: string
  events?: string[] // Event names for ES
}

/**
 * Send staff invitation email (ES or TD)
 */
export async function sendStaffInviteEmail({
  to,
  staffName,
  tournamentName,
  role,
  inviteToken,
  inviterName,
  events = [],
}: StaffInviteEmailParams): Promise<{ messageId: string | null }> {
  try {
    if (!resend) {
      console.error('RESEND_API_KEY is not configured')
      return { messageId: null }
    }

    const baseUrl = getBaseUrl()
    const portalUrl = role === 'EVENT_SUPERVISOR' 
      ? `${baseUrl}/es?token=${inviteToken}`
      : `${baseUrl}/td?token=${inviteToken}`

    const roleLabel = role === 'EVENT_SUPERVISOR' ? 'Event Supervisor' : 'Tournament Director'
    const greeting = staffName ? `Hi ${staffName},` : 'Hello,'

    const eventsSection = events.length > 0 ? `
      <div style="background-color: #f3f4f6; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #1f2937; font-size: 14px; margin-top: 0; margin-bottom: 8px;">Assigned Events:</h3>
        <ul style="color: #374151; font-size: 14px; margin: 0; padding-left: 20px;">
          ${events.map(e => `<li style="margin: 4px 0;">${e}</li>`).join('')}
        </ul>
      </div>
    ` : ''

    console.log('Sending staff invite email via Resend:', {
      to,
      role,
      tournamentName,
    })

    const { data, error } = await resend.emails.send({
      from: 'Teamy <no-reply@teamy.site>',
      to,
      subject: `You've been invited as ${roleLabel} for ${tournamentName}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-top: 0;">
            ${roleLabel} Invitation
          </h1>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            ${greeting}
          </p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            <strong>${inviterName}</strong> has invited you to join <strong>${tournamentName}</strong> as a ${roleLabel}.
          </p>
          
          ${eventsSection}
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            ${role === 'EVENT_SUPERVISOR' 
              ? 'As an Event Supervisor, you\'ll be able to create and manage tests for your assigned events using our built-in test editor.' 
              : 'As a Tournament Director, you\'ll have full access to manage the tournament, invite staff, and oversee all operations.'}
          </p>
          
          <div style="text-align: center; padding: 24px 0;">
            <a href="${portalUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Accept Invitation & Sign In
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            Or copy and paste this link into your browser:<br/>
            <a href="${portalUrl}" style="color: #3b82f6; word-break: break-all;">${portalUrl}</a>
          </p>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Teamy • Science Olympiad Tournament Management
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend API error:', error)
      return { messageId: null }
    }

    console.log('Staff invite email sent successfully, message ID:', data?.id)
    return { messageId: data?.id || null }
  } catch (error) {
    console.error('Email service error:', error)
    return { messageId: null }
  }
}

export interface CalendarEventDetails {
  startUTC: Date
  endUTC: Date
  location?: string
  description?: string
  rsvpEnabled?: boolean
}

export interface SendAnnouncementEmailParams {
  to: string[]
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  clubId: string
  clubName: string
  title: string
  content: string
  announcementId: string
  calendarEvent?: CalendarEventDetails
}

/**
 * Format event time for email display
 */
function formatEventTimeForEmail(startUTC: Date, endUTC: Date): string {
  const startDate = new Date(startUTC)
  const endDate = new Date(endUTC)
  
  // Check if it's an all-day event
  const isAllDay = startDate.getHours() === 0 && startDate.getMinutes() === 0 && 
                   endDate.getHours() === 23 && endDate.getMinutes() === 59
  
  if (isAllDay) {
    if (startDate.toDateString() === endDate.toDateString()) {
      return startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } else {
      const startDay = startDate.getDate()
      const endDay = endDate.getDate()
      const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' })
      const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' })
      const startYear = startDate.getFullYear()
      const endYear = endDate.getFullYear()
      
      if (startMonth === endMonth && startYear === endYear) {
        return `${startMonth} ${startDay}-${endDay}, ${startYear}`
      } else if (startYear === endYear) {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`
      } else {
        return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`
      }
    }
  } else {
    return `${startDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })} - ${endDate.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`
  }
}

/**
 * Send announcement email to users
 */
export async function sendAnnouncementEmail({
  to,
  cc,
  bcc,
  replyTo,
  clubId,
  clubName,
  title,
  content,
  announcementId,
  calendarEvent,
}: SendAnnouncementEmailParams): Promise<{ messageId: string | null }> {
  try {
    // Validate we have the API key
    if (!resend) {
      console.error('RESEND_API_KEY is not configured')
      return { messageId: null }
    }

    // Validate we have at least one recipient
    if (!to || to.length === 0) {
      console.error('No primary recipients provided')
      return { messageId: null }
    }

    // Build the club stream URL
    const baseUrl = getBaseUrl()
    const clubStreamUrl = `${baseUrl}/club/${clubId}?tab=stream`

    // Build event details section if this is an event announcement
    let eventDetailsHtml = ''
    if (calendarEvent) {
      const formattedTime = formatEventTimeForEmail(calendarEvent.startUTC, calendarEvent.endUTC)
      eventDetailsHtml = `
        <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <h2 style="color: #1f2937; font-size: 16px; margin-top: 0; margin-bottom: 12px;">📅 Event Details</h2>
          <div style="color: #374151; font-size: 14px; line-height: 1.8;">
            <p style="margin: 8px 0;"><strong>When:</strong> ${formattedTime}</p>
            ${calendarEvent.location ? `<p style="margin: 8px 0;"><strong>Where:</strong> ${calendarEvent.location}</p>` : ''}
          </div>
          ${calendarEvent.rsvpEnabled ? `
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #d1d5db;">
            <p style="color: #6b7280; font-size: 13px; margin: 0;">
              💬 <strong>Please RSVP on the club stream</strong> to let us know if you're coming!
            </p>
          </div>
          ` : ''}
        </div>
      `
    }

    console.log('Sending email via Resend:', {
      to: to.length,
      cc: cc?.length || 0,
      bcc: bcc?.length || 0,
      subject: `[${clubName}] ${title}`,
    })

    const { data, error } = await resend.emails.send({
      from: 'Teamy <no-reply@teamy.site>',
      to,
      cc,
      bcc,
      replyTo,
      subject: `[${clubName}] ${title}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-top: 0;">
            ${title}
          </h1>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
            Posted in <strong>${clubName}</strong>
          </p>
          
          ${eventDetailsHtml}
          
          <div style="color: #374151; line-height: 1.6; white-space: pre-wrap; margin-bottom: 32px;">
            ${content}
          </div>
          
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <div style="text-align: center; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px 0;">
              View and respond to this announcement on your club stream
            </p>
            <a href="${clubStreamUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
              Go to Club Stream
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
            Teamy • Club Management Platform
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend API error:', error)
      return { messageId: null }
    }

    console.log('Email sent successfully, message ID:', data?.id)
    return { messageId: data?.id || null }
  } catch (error) {
    console.error('Email service error:', error)
    return { messageId: null }
  }
}
