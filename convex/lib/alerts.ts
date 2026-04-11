import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { internal } from '../_generated/api'
import { log } from './logger'

const ALERT_RECIPIENT = 'alerts@divedispatch.dev'
const FROM_ADDRESS = 'alerts@divedispatch.dev'
const RESEND_API_URL = 'https://api.resend.com/emails'

export function buildAlertEmailHtml(args: {
  jobName: string
  error: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cron Failure Alert</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#dc2626;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">DiveDispatch Alert</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="color:#111827;font-size:16px;margin:0 0 16px;font-weight:600;">Cron Job Failure</p>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px;">
                <strong>Job:</strong> ${args.jobName}
              </p>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
                <strong>Error:</strong> ${args.error}
              </p>
              <p style="color:#6b7280;font-size:13px;margin:24px 0 0;">
                Timestamp: ${new Date().toISOString()}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                Automated alert from DiveDispatch monitoring.
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

export const sendAlert = internalMutation({
  args: {
    jobName: v.string(),
    status: v.union(v.literal('success'), v.literal('failure')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('cronRunLog', {
      jobName: args.jobName,
      status: args.status,
      ...(args.error !== undefined ? { error: args.error } : {}),
      runAt: Date.now(),
    })

    if (process.env.NODE_ENV === 'test') {
      return
    }

    if (args.status === 'failure' && args.error) {
      log.error('Cron job failed', { jobName: args.jobName, error: args.error })

      await ctx.scheduler.runAfter(0, internal.lib.alerts.sendAlertEmail, {
        jobName: args.jobName,
        error: args.error,
      })
    }
  },
})

import { internalAction } from '../_generated/server'

export const sendAlertEmail = internalAction({
  args: {
    jobName: v.string(),
    error: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      log.error('RESEND_API_KEY not configured — skipping alert email', {
        jobName: args.jobName,
      })
      return
    }

    const html = buildAlertEmailHtml(args)

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: ALERT_RECIPIENT,
        subject: `[DiveDispatch Alert] Cron failure: ${args.jobName}`,
        html,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      log.error('Alert email failed to send', {
        status: response.status,
        body: errorBody,
      })
    }
  },
})
