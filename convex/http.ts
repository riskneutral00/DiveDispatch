import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { isTimestampFresh } from './lib/webhookTimestamp'
import { constantTimeEqual } from './lib/constantTimeEqual'
import { isDevEnvironment } from './lib/devGuard'

const http = httpRouter()

http.route({
  path: '/health',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    try {
      const canary = await ctx.runQuery(internal.healthCheck.ping)
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: Date.now(), canary }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    } catch {
      return new Response(
        JSON.stringify({ status: 'error', timestamp: Date.now() }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }),
})

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

  const computedBytes = new Uint8Array(signatureBuffer)

  for (const entry of svixSignature.split(' ')) {
    const [version, sig] = entry.split(',')
    if (version !== 'v1' || !sig) continue

    let sigBytes: Uint8Array
    try {
      const decoded = atob(sig)
      sigBytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        sigBytes[i] = decoded.charCodeAt(i)
      }
    } catch {
      continue
    }

    if (constantTimeEqual(computedBytes, sigBytes)) return true
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

type ClerkOrganizationPayload = {
  id: string
  name?: string
  slug?: string
  created_by?: string
  deleted?: boolean
}

type ClerkMembershipPayload = {
  id: string
  organization?: { id: string }
  public_user_data?: { user_id: string }
  role?: string
}

type ClerkWebhookEvent =
  | { type: 'user.created' | 'user.updated' | 'user.deleted'; data: ClerkUserPayload }
  | { type: 'organization.created' | 'organization.updated' | 'organization.deleted'; data: ClerkOrganizationPayload }
  | {
      type:
        | 'organizationMembership.created'
        | 'organizationMembership.updated'
        | 'organizationMembership.deleted'
      data: ClerkMembershipPayload
    }
  | { type: string; data: unknown }

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

    if (event.type === 'user.created' || event.type === 'user.updated') {
      const userData = event.data as ClerkUserPayload
      const tokenIdentifier = `${issuerUrl}|${userData.id}`
      const primaryEmail =
        userData.email_addresses?.find((e) => e.primary)?.email_address ??
        userData.email_addresses?.[0]?.email_address ??
        ''
      const firstName = userData.first_name ?? ''
      const lastName = userData.last_name ?? ''
      const name = [firstName, lastName].filter(Boolean).join(' ')

      await ctx.runMutation(internal.users.upsertFromWebhook, {
        tokenIdentifier,
        email: primaryEmail,
        name,
        firstName,
        lastName,
        svixId,
      })
    } else if (event.type === 'user.deleted') {
      const userData = event.data as ClerkUserPayload
      const tokenIdentifier = `${issuerUrl}|${userData.id}`
      await ctx.runMutation(internal.users.deleteFromWebhook, {
        tokenIdentifier,
        svixId,
      })
    } else if (event.type === 'organization.created' || event.type === 'organization.updated') {
      const orgData = event.data as ClerkOrganizationPayload
      await ctx.runMutation(internal.organizations.upsertFromWebhook, {
        clerkOrgId: orgData.id,
        name: orgData.name ?? '',
        slug: orgData.slug ?? '',
        svixId,
        ...(orgData.created_by && { creatorTokenIdentifier: `${issuerUrl}|${orgData.created_by}` }),
      })
    } else if (event.type === 'organization.deleted') {
      const orgData = event.data as ClerkOrganizationPayload
      await ctx.runMutation(internal.organizations.deleteFromWebhook, {
        clerkOrgId: orgData.id,
        svixId,
      })
    } else if (
      event.type === 'organizationMembership.created' ||
      event.type === 'organizationMembership.updated'
    ) {
      const membershipData = event.data as ClerkMembershipPayload
      const clerkUserId = membershipData.public_user_data?.user_id
      const clerkOrgId = membershipData.organization?.id
      if (clerkUserId && clerkOrgId) {
        await ctx.runMutation(internal.userRoles.upsertFromMembershipWebhook, {
          tokenIdentifier: `${issuerUrl}|${clerkUserId}`,
          clerkOrgId,
          clerkRole: membershipData.role,
          svixId,
        })
      }
    } else if (event.type === 'organizationMembership.deleted') {
      const membershipData = event.data as ClerkMembershipPayload
      const clerkUserId = membershipData.public_user_data?.user_id
      const clerkOrgId = membershipData.organization?.id
      if (clerkUserId && clerkOrgId) {
        await ctx.runMutation(internal.userRoles.deleteFromMembershipWebhook, {
          tokenIdentifier: `${issuerUrl}|${clerkUserId}`,
          clerkOrgId,
          svixId,
        })
      }
    }

    return new Response(null, { status: 200 })
  }),
})

http.route({
  path: '/dev/signin-token',
  method: 'POST',
  handler: httpAction(async (_ctx, request) => {
    if (!isDevEnvironment()) {
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

http.route({
  path: '/dev/delete-user',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!isDevEnvironment()) {
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
    if (!isDevEnvironment()) {
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
