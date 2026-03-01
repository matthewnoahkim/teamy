import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

const EMAIL_THEME = {
  background: '#08122b',
  card: '#0f1d3d',
  cardBorder: '#223f74',
  title: '#f5f8ff',
  body: '#d3def2',
  muted: '#a7b8d8',
  primary: '#0056C7',
  primaryDark: '#00469f',
  accentSoft: '#13284f',
  accentBorder: '#335a98',
  positiveSoft: '#12324a',
  positiveBorder: '#2f6d91',
} as const

export interface TeamyEmailLayoutParams {
  preheader: string
  label: string
  title: string
  subtitle?: string
  logoUrl?: string
  bodyHtml: string
  actionLabel?: string
  actionUrl?: string
  actionHintHtml?: string
  footerText?: string
}

/**
 * Escape HTML special characters to prevent XSS/injection in email templates.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeHtmlWithLineBreaks(str: string): string {
  return escapeHtml(str).replace(/\r?\n/g, '<br />')
}

/**
 * Get the base URL for the app.
 * Uses NEXTAUTH_URL if set, otherwise VERCEL_URL for production, or localhost for development.
 */
function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.NODE_ENV === 'production') return 'https://teamy.site'
  return 'http://localhost:3000'
}

/**
 * Shared Teamy email wrapper so all notification emails stay visually consistent.
 */
export function renderTeamyEmailLayout({
  preheader,
  label,
  title,
  subtitle,
  logoUrl,
  bodyHtml,
  actionLabel,
  actionUrl,
  actionHintHtml,
  footerText,
}: TeamyEmailLayoutParams): string {
  const safePreheader = escapeHtml(preheader)
  const safeLabel = escapeHtml(label)
  const safeTitle = escapeHtml(title)
  const safeSubtitle = subtitle ? escapeHtml(subtitle) : null
  const safeLogoUrl = escapeHtml(logoUrl || `${getBaseUrl()}/logo.png`)
  const safeActionLabel = actionLabel ? escapeHtml(actionLabel) : null
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : null
  const footer = escapeHtml(footerText ?? 'Teamy • Science Olympiad Management Platform')

  const actionBlock =
    safeActionLabel && safeActionUrl
      ? `
        <div style="text-align:center; margin: 24px 0 8px 0;">
          <a href="${safeActionUrl}" style="display:inline-block; background:${EMAIL_THEME.primary}; color:#ffffff; text-decoration:none; font-weight:700; font-size:14px; padding:11px 22px; border-radius:8px; border:1px solid ${EMAIL_THEME.primaryDark};">
            ${safeActionLabel}
          </a>
        </div>
      `
      : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0; padding:0; background-color:${EMAIL_THEME.background};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${safePreheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px; border-collapse:separate; border-spacing:0; border:1px solid ${EMAIL_THEME.cardBorder}; border-radius:14px; overflow:hidden; background:${EMAIL_THEME.card};">
          <tr>
            <td style="padding:0;">
              <div style="height:4px; width:100%; background:${EMAIL_THEME.primary};"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 22px 0 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td valign="middle" style="width:44px;">
                    <img src="${safeLogoUrl}" alt="Teamy logo" width="32" height="32" style="display:block; width:32px; height:32px; border-radius:8px;" />
                  </td>
                  <td valign="middle">
                    <p style="margin:0; color:${EMAIL_THEME.title}; font-size:18px; font-weight:700; letter-spacing:0.1px;">Teamy</p>
                    <p style="margin:2px 0 0 0; color:${EMAIL_THEME.muted}; font-size:11px;">Science Olympiad workspace</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 22px 0 22px;">
              <div style="display:inline-block; border:1px solid ${EMAIL_THEME.accentBorder}; background:${EMAIL_THEME.accentSoft}; color:${EMAIL_THEME.muted}; font-size:10px; text-transform:uppercase; letter-spacing:0.6px; font-weight:700; border-radius:999px; padding:5px 9px;">
                ${safeLabel}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 22px 0 22px;">
              <h1 style="margin:0; color:${EMAIL_THEME.title}; font-size:24px; line-height:1.28; font-weight:700;">${safeTitle}</h1>
              ${
                safeSubtitle
                  ? `<p style="margin:8px 0 0 0; color:${EMAIL_THEME.muted}; font-size:13px; line-height:1.5;">${safeSubtitle}</p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:16px 22px 0 22px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 22px 0 22px;">
              ${actionBlock}
              ${actionHintHtml ?? ''}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 22px 22px 22px;">
              <div style="border-top:1px solid ${EMAIL_THEME.cardBorder}; padding-top:12px; text-align:center; color:${EMAIL_THEME.muted}; font-size:12px; line-height:1.5;">
                ${footer}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export interface StaffInviteEmailParams {
  to: string
  staffName?: string
  tournamentName: string
  role: 'EVENT_SUPERVISOR' | 'TOURNAMENT_DIRECTOR'
  inviteToken: string
  inviterName: string
  events?: string[]
}

/**
 * Send staff invitation email (ES or TD).
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
    const portalUrl =
      role === 'EVENT_SUPERVISOR'
        ? `${baseUrl}/es?token=${inviteToken}`
        : `${baseUrl}/td?token=${inviteToken}`

    const roleLabel = role === 'EVENT_SUPERVISOR' ? 'Event Supervisor' : 'Tournament Director'
    const greeting = staffName ? `Hi ${escapeHtml(staffName)},` : 'Hello,'

    const eventsSection =
      events.length > 0
        ? `
          <div style="background:${EMAIL_THEME.positiveSoft}; border:1px solid ${EMAIL_THEME.positiveBorder}; border-radius:12px; padding:14px 16px; margin:0 0 18px 0;">
            <p style="margin:0 0 8px 0; color:${EMAIL_THEME.title}; font-size:14px; font-weight:700;">Assigned events</p>
            <ul style="margin:0; padding-left:18px; color:${EMAIL_THEME.body}; font-size:14px; line-height:1.7;">
              ${events.map(eventName => `<li>${escapeHtml(eventName)}</li>`).join('')}
            </ul>
          </div>
        `
        : ''

    const bodyHtml = `
      <p style="margin:0 0 14px 0; color:${EMAIL_THEME.body}; font-size:15px; line-height:1.7;">${greeting}</p>
      <p style="margin:0 0 14px 0; color:${EMAIL_THEME.body}; font-size:15px; line-height:1.7;">
        <strong style="color:${EMAIL_THEME.title};">${escapeHtml(inviterName)}</strong> invited you to
        <strong style="color:${EMAIL_THEME.title};">${escapeHtml(tournamentName)}</strong> as
        <strong style="color:${EMAIL_THEME.title};">${escapeHtml(roleLabel)}</strong>.
      </p>
      ${eventsSection}
      <p style="margin:0; color:${EMAIL_THEME.muted}; font-size:13px; line-height:1.65;">
        Use the same email address this invite was sent to when signing in.
      </p>
    `

    const actionHintHtml = `
      <p style="margin:12px 0 0 0; color:${EMAIL_THEME.muted}; font-size:12px; line-height:1.6; text-align:center;">
        Direct link:<br />
        <a href="${escapeHtml(portalUrl)}" style="color:#8ec5ff; word-break:break-all;">${escapeHtml(portalUrl)}</a>
      </p>
    `

    const html = renderTeamyEmailLayout({
      preheader: `${roleLabel} invite for ${tournamentName}`,
      label: 'Tournament Invitation',
      title: `${roleLabel} Invitation`,
      subtitle: tournamentName,
      bodyHtml,
      actionLabel: 'Accept Invitation',
      actionUrl: portalUrl,
      actionHintHtml,
      footerText: 'Teamy • Science Olympiad Tournament Management',
    })

    console.log('Sending staff invite email via Resend:', { to, role, tournamentName })

    const { data, error } = await resend.emails.send({
      from: 'Teamy <no-reply@teamy.site>',
      to,
      subject: `Invitation: ${tournamentName} (${roleLabel})`,
      html,
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
 * Format event time for email display.
 */
function formatEventTimeForEmail(startUTC: Date, endUTC: Date): string {
  const startDate = new Date(startUTC)
  const endDate = new Date(endUTC)

  const isAllDay =
    startDate.getHours() === 0 &&
    startDate.getMinutes() === 0 &&
    endDate.getHours() === 23 &&
    endDate.getMinutes() === 59

  if (isAllDay) {
    if (startDate.toDateString() === endDate.toDateString()) {
      return startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    const startDay = startDate.getDate()
    const endDay = endDate.getDate()
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' })
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' })
    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()

    if (startMonth === endMonth && startYear === endYear) {
      return `${startMonth} ${startDay}-${endDay}, ${startYear}`
    }
    if (startYear === endYear) {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`
    }
    return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`
  }

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

/**
 * Send announcement email to users.
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
  announcementId: _announcementId,
  calendarEvent,
}: SendAnnouncementEmailParams): Promise<{ messageId: string | null }> {
  try {
    if (!resend) {
      console.error('RESEND_API_KEY is not configured')
      return { messageId: null }
    }

    if (!to || to.length === 0) {
      console.error('No primary recipients provided')
      return { messageId: null }
    }

    const baseUrl = getBaseUrl()
    const clubStreamUrl = `${baseUrl}/club/${clubId}?tab=stream`

    let eventDetailsHtml = ''
    if (calendarEvent) {
      const formattedTime = formatEventTimeForEmail(calendarEvent.startUTC, calendarEvent.endUTC)
      eventDetailsHtml = `
        <div style="background:${EMAIL_THEME.accentSoft}; border:1px solid ${EMAIL_THEME.accentBorder}; border-radius:12px; padding:14px 16px; margin:0 0 18px 0;">
          <p style="margin:0 0 10px 0; color:${EMAIL_THEME.title}; font-size:14px; font-weight:700;">Event details</p>
          <p style="margin:0 0 6px 0; color:${EMAIL_THEME.body}; font-size:14px; line-height:1.6;"><strong style="color:${EMAIL_THEME.title};">When:</strong> ${escapeHtml(formattedTime)}</p>
          ${calendarEvent.location ? `<p style="margin:0; color:${EMAIL_THEME.body}; font-size:14px; line-height:1.6;"><strong style="color:${EMAIL_THEME.title};">Where:</strong> ${escapeHtml(calendarEvent.location)}</p>` : ''}
          ${
            calendarEvent.rsvpEnabled
              ? `<p style="margin:10px 0 0 0; color:${EMAIL_THEME.muted}; font-size:13px; line-height:1.5;">RSVP is enabled. Respond from the club stream.</p>`
              : ''
          }
        </div>
      `
    }

    const safeContent = escapeHtmlWithLineBreaks(content)
    const bodyHtml = `
      ${eventDetailsHtml}
      <div style="margin:0; padding:14px 16px; background:#091329; border:1px solid ${EMAIL_THEME.cardBorder}; border-radius:12px; color:${EMAIL_THEME.body}; font-size:14px; line-height:1.72; word-break:break-word;">
        ${safeContent}
      </div>
    `

    const actionHintHtml = `
      <p style="margin:12px 0 0 0; color:${EMAIL_THEME.muted}; font-size:12px; line-height:1.6; text-align:center;">
        Direct link:<br />
        <a href="${escapeHtml(clubStreamUrl)}" style="color:#8ec5ff; word-break:break-all;">${escapeHtml(clubStreamUrl)}</a>
      </p>
    `

    const html = renderTeamyEmailLayout({
      preheader: `New announcement in ${clubName}: ${title}`,
      label: 'Club Announcement',
      title,
      subtitle: clubName,
      bodyHtml,
      actionLabel: 'Open Club Stream',
      actionUrl: clubStreamUrl,
      actionHintHtml,
      footerText: 'Teamy • Club Management Platform',
    })

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
      html,
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
