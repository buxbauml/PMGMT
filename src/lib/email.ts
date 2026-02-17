import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL = process.env.EMAIL_FROM || 'PMGMT <onboarding@resend.dev>'

interface SendInvitationEmailParams {
  to: string
  workspaceName: string
  inviterName: string
  role: string
  inviteLink: string
}

export async function sendInvitationEmail({
  to,
  workspaceName,
  inviterName,
  role,
  inviteLink,
}: SendInvitationEmailParams): Promise<{ error: string | null }> {
  if (!resend) {
    console.warn(
      '[email] RESEND_API_KEY not configured. Skipping email delivery for invitation to:',
      to
    )
    return { error: null }
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You've been invited to join ${workspaceName}`,
      html: buildInvitationHtml({ workspaceName, inviterName, role, inviteLink }),
    })

    if (error) {
      console.error('[email] Failed to send invitation email:', error)
      return { error: error.message }
    }

    return { error: null }
  } catch (err) {
    console.error('[email] Unexpected error sending invitation email:', err)
    return { error: 'Failed to send invitation email' }
  }
}

function buildInvitationHtml({
  workspaceName,
  inviterName,
  role,
  inviteLink,
}: Omit<SendInvitationEmailParams, 'to'>): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 0; text-align: center;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #18181b;">
                Workspace Invitation
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 24px 32px;">
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #3f3f46;">
                <strong>${escapeHtml(inviterName)}</strong> has invited you to join
                <strong>${escapeHtml(workspaceName)}</strong> as a <strong>${escapeHtml(role)}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 16px;">
                    <a href="${escapeHtml(inviteLink)}"
                       style="display: inline-block; padding: 12px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; font-size: 12px; line-height: 1.5; color: #71717a;">
                This invitation will expire in 7 days. If you don't have an account yet, you'll be prompted to create one.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #71717a;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px 24px; text-align: center; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                Sent by PMGMT
              </p>
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
