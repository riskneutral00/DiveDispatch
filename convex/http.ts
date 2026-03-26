import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { isTimestampFresh } from './lib/webhookTimestamp'

const http = httpRouter()

// Verify Svix webhook signature using the Web Crypto API.
// Svix signing algorithm: HMAC-SHA256 over "${svix-id}.${svix-timestamp}.${body}",
// key = base64-decoded secret (strip "whsec_" prefix).
// Signature header may contain multiple space-separated "v1,<base64>" entries.
async function verifyWebhookSignature(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  const rawKey = secret.startsWith('whsec_') ? secret.slice(6) : secret
  const keyBytes = atob(rawKey)
  const keyBuffer = new Uint8Array(keyBytes.length)
  for (let i = 0; i < keyBytes.length; i++) {
    keyBuffer[i] = keyBytes.charCodeAt(i)
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const toSign = `${svixId}.${svixTimestamp}.${payload}`
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(toSign),
  )

  const computedSig = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer)),
  )

  for (const entry of svixSignature.split(' ')) {
    const [version, sig] = entry.split(',')
    if (version === 'v1' && sig === computedSig) return true
  }

  return false
}

type ClerkUserPayload = {
  id: string
  email_addresses?: Array<{ email_address: string; primary: boolean }>
  first_name?: string | null
  last_name?: string | null
  deleted?: boolean
}

type ClerkWebhookEvent = {
  type: string
  data: ClerkUserPayload
}

http.route({
  path: '/webhooks/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      return new Response('Webhook secret not configured', { status: 500 })
    }

    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing svix headers', { status: 400 })
    }

    if (!isTimestampFresh(svixTimestamp)) {
      return new Response('Timestamp too old or too new', { status: 400 })
    }

    const payload = await request.text()

    const isValid = await verifyWebhookSignature(
      payload,
      svixId,
      svixTimestamp,
      svixSignature,
      webhookSecret,
    )

    if (!isValid) {
      return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(payload) as ClerkWebhookEvent
    const issuerUrl = process.env.CLERK_ISSUER_URL ?? ''
    const tokenIdentifier = `${issuerUrl}|${event.data.id}`

    if (event.type === 'user.created' || event.type === 'user.updated') {
      const primaryEmail =
        event.data.email_addresses?.find((e) => e.primary)?.email_address ??
        event.data.email_addresses?.[0]?.email_address ??
        ''
      const firstName = event.data.first_name ?? ''
      const lastName = event.data.last_name ?? ''
      const name = [firstName, lastName].filter(Boolean).join(' ')

      await ctx.runMutation(internal.users.upsertFromWebhook, {
        tokenIdentifier,
        email: primaryEmail,
        name,
        firstName,
        lastName,
      })
    } else if (event.type === 'user.deleted') {
      await ctx.runMutation(internal.users.deleteFromWebhook, {
        tokenIdentifier,
      })
    }

    return new Response(null, { status: 200 })
  }),
})

// DEV-ONLY: generate a Clerk sign-in token for Playwright E2E tests.
// Returns 403 in production. Never expose real user credentials.
http.route({
  path: '/dev/signin-token',
  method: 'POST',
  handler: httpAction(async (_ctx, request) => {
    if (process.env.ENVIRONMENT !== 'development') {
      return new Response('Forbidden', { status: 403 })
    }

    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      return new Response('CLERK_SECRET_KEY not configured', { status: 500 })
    }

    let email: string
    try {
      const body = (await request.json()) as { email?: string }
      if (!body.email || typeof body.email !== 'string') {
        return new Response('email is required', { status: 400 })
      }
      email = body.email
    } catch {
      return new Response('Invalid JSON body', { status: 400 })
    }

    // Look up Clerk user by email
    const usersRes = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    )
    if (!usersRes.ok) {
      return new Response('Failed to look up user', { status: 500 })
    }
    const users = (await usersRes.json()) as Array<{ id: string }>
    if (!users.length) {
      return new Response('User not found', { status: 404 })
    }
    const userId = users[0].id

    // Create sign-in token for that user
    const tokenRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    })
    if (!tokenRes.ok) {
      return new Response('Failed to create sign-in token', { status: 500 })
    }
    const tokenData = (await tokenRes.json()) as { token: string; url: string }

    return new Response(JSON.stringify({ token: tokenData.token, url: tokenData.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
})

// DEV-ONLY: delete a Convex user record by email for E2E test setup.
// Clears the webhook-created user so the account page shows the setup wizard.
http.route({
  path: '/dev/delete-user',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (process.env.ENVIRONMENT !== 'development') {
      return new Response('Forbidden', { status: 403 })
    }

    let email: string
    try {
      const body = (await request.json()) as { email?: string }
      if (!body.email || typeof body.email !== 'string') {
        return new Response('email is required', { status: 400 })
      }
      email = body.email
    } catch {
      return new Response('Invalid JSON body', { status: 400 })
    }

    const result = await ctx.runMutation(internal.testHelpers.deleteUserByEmail, { email })
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
})

http.route({
  path: '/dev/complete-customer-form',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (process.env.ENVIRONMENT !== 'development') {
      return new Response('Forbidden', { status: 403 })
    }

    let bookingId: string
    try {
      const body = (await request.json()) as { ownerSlug?: string }
      if (!body.ownerSlug || typeof body.ownerSlug !== 'string') {
        return new Response('ownerSlug is required', { status: 400 })
      }
      bookingId = body.ownerSlug
    } catch {
      return new Response('Invalid JSON body', { status: 400 })
    }

    const result = await ctx.runMutation(internal.testHelpers.completeCustomerForm, {
      ownerSlug: bookingId,
    })
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
})

export default http
