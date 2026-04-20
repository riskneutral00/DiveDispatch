#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'

const TEMPLATE_NAME = 'convex'
const TEMPLATE_CLAIMS = {
  aud: 'convex',
  orgId: '{{org.id}}',
  orgRole: '{{org.role}}',
  orgSlug: '{{org.slug}}',
}
const TOKEN_LIFETIME = 60
const CLOCK_SKEW = 5

function readEnvLocal(): Record<string, string> {
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
      if (match) env[match[1]] = match[2].trim()
    }
    return env
  } catch {
    return {}
  }
}

const envLocal = readEnvLocal()
const secretKey = process.env.CLERK_SECRET_KEY ?? envLocal['CLERK_SECRET_KEY']
if (!secretKey) {
  console.error('CLERK_SECRET_KEY environment variable is required')
  process.exit(1)
}

const API_BASE = 'https://api.clerk.com/v1'

async function listTemplates(): Promise<Array<{ id: string; name: string; claims: unknown }>> {
  const res = await fetch(`${API_BASE}/jwt_templates`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!res.ok) {
    throw new Error(`listTemplates failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as Array<{ id: string; name: string; claims: unknown }>
}

async function createTemplate(): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_BASE}/jwt_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: TEMPLATE_NAME,
      claims: TEMPLATE_CLAIMS,
      lifetime: TOKEN_LIFETIME,
      allowed_clock_skew: CLOCK_SKEW,
    }),
  })
  if (!res.ok) {
    throw new Error(`createTemplate failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as { id: string; name: string }
}

async function updateTemplate(id: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_BASE}/jwt_templates/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: TEMPLATE_NAME,
      claims: TEMPLATE_CLAIMS,
      lifetime: TOKEN_LIFETIME,
      allowed_clock_skew: CLOCK_SKEW,
    }),
  })
  if (!res.ok) {
    throw new Error(`updateTemplate failed: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as { id: string; name: string }
}

async function main(): Promise<void> {
  console.log(`Ensuring JWT template '${TEMPLATE_NAME}' with claims: ${JSON.stringify(Object.keys(TEMPLATE_CLAIMS))}`)
  const templates = await listTemplates()
  const existing = templates.find((t) => t.name === TEMPLATE_NAME)
  if (existing) {
    const currentClaims = existing.claims as Record<string, unknown>
    const needsUpdate = Object.entries(TEMPLATE_CLAIMS).some(([k, v]) => currentClaims[k] !== v)
    if (needsUpdate) {
      console.log(`  template exists (${existing.id}) but claims drift — patching`)
      await updateTemplate(existing.id)
      console.log(`  patched ${existing.id}`)
    } else {
      console.log(`  template exists (${existing.id}) with correct claims — skipping`)
    }
    return
  }
  console.log(`  template missing — creating`)
  const created = await createTemplate()
  console.log(`  created ${created.id} (${created.name})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
