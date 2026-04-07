import { v } from 'convex/values'
import { action } from './_generated/server'

const RESEND_API_URL = 'https://api.resend.com/emails'
const FROM_ADDRESS = 'bookings@divedispatch.dev'

export function buildPortalEmailHtml(args: {
  customerName: string
  operatorName: string
  portalUrl: string
  expiresAt: number
}): string {
  const expiryDate = new Date(args.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Dive Booking Portal</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#0891b2;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">DiveDispatch</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="color:#111827;font-size:16px;margin:0 0 16px;">Hi ${args.customerName},</p>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
                <strong>${args.operatorName}</strong> has shared a booking portal with you.
                Click the button below to complete your diver information.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${args.portalUrl}"
                   style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
                  Open My Booking Portal
                </a>
              </div>
              <p style="color:#6b7280;font-size:13px;margin:24px 0 0;text-align:center;">
                This link expires on <strong>${expiryDate}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                Sent by DiveDispatch on behalf of ${args.operatorName}.<br />
                Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export const sendBookingLinkEmail = action({
  args: {
    to: v.string(),
    customerName: v.string(),
    operatorName: v.string(),
    portalUrl: v.string(),
    expiresAt: v.number(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured in Convex environment variables')
    }

    const html = buildPortalEmailHtml(args)

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: args.to,
        subject: `Your booking portal from ${args.operatorName}`,
        html,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Resend API error ${response.status}: ${errorBody}`)
    }
  },
})
