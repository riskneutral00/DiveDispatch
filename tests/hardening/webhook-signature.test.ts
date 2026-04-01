/**
 * @module-tag slow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { makeT } from '../helpers/convex-helpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'whsec_dGVzdHNlY3JldGtleWZvcnVuaXR0ZXN0aW5n' // whsec_ + base64("testsecretkeyforunittesting")

function makeClerkEvent(type: string, userId: string) {
  return JSON.stringify({
    type,
    data: {
      id: userId,
      email_addresses: [{ email_address: 'test@example.com', primary: true }],
      first_name: 'Test',
      last_name: 'User',
    },
  })
}

async function signPayload(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  secret: string,
): Promise<string> {
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

  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
  return `v1,${base64Sig}`
}

// ─── Env Setup ────────────────────────────────────────────────────────────────

let savedSecret: string | undefined
let savedIssuer: string | undefined

beforeEach(() => {
  savedSecret = process.env.CLERK_WEBHOOK_SECRET
  savedIssuer = process.env.CLERK_ISSUER_URL
  process.env.CLERK_WEBHOOK_SECRET = TEST_SECRET
  process.env.CLERK_ISSUER_URL = 'https://convex.test'
})

afterEach(() => {
  if (savedSecret !== undefined) {
    process.env.CLERK_WEBHOOK_SECRET = savedSecret
  } else {
    delete process.env.CLERK_WEBHOOK_SECRET
  }
  if (savedIssuer !== undefined) {
    process.env.CLERK_ISSUER_URL = savedIssuer
  } else {
    delete process.env.CLERK_ISSUER_URL
  }
})

// ─── H-WH: Webhook Signature Verification ────────────────────────────────────

describe('H-WH: Webhook Signature Verification', () => {
  it('H-WH-01: missing svix headers → 400', async () => {
    const t = makeT()
    const response = await t.fetch('/webhooks/clerk', {
      method: 'POST',
      body: '{}',
    })
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toContain('Missing svix headers')
  })

  it('H-WH-02: invalid signature → 400', async () => {
    const t = makeT()
    const payload = makeClerkEvent('user.created', 'user_test123')

    const response = await t.fetch('/webhooks/clerk', {
      method: 'POST',
      headers: {
        'svix-id': 'msg_test123',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalidsignaturevalue',
      },
      body: payload,
    })
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).toContain('Invalid signature')
  })

  it('H-WH-03: valid signature → 200 + user upserted', async () => {
    const t = makeT()
    const payload = makeClerkEvent('user.created', 'user_valid456')
    const svixId = 'msg_valid456'
    const svixTimestamp = String(Math.floor(Date.now() / 1000))
    const signature = await signPayload(payload, svixId, svixTimestamp, TEST_SECRET)

    const response = await t.fetch('/webhooks/clerk', {
      method: 'POST',
      headers: {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': signature,
      },
      body: payload,
    })
    expect(response.status).toBe(200)
  })

  it('H-WH-04: missing CLERK_WEBHOOK_SECRET → 500', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET

    const t = makeT()
    const response = await t.fetch('/webhooks/clerk', {
      method: 'POST',
      body: '{}',
    })
    expect(response.status).toBe(500)
    const text = await response.text()
    expect(text).toContain('Webhook secret not configured')
  })
})
