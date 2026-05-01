#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'

const API_BASE = 'https://api.clerk.com/v1'

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
  console.error('CLERK_SECRET_KEY required')
  process.exit(1)
}

interface SvixEndpoint {
  id: string
  url: string
  description?: string
  disabled?: boolean
}

async function main() {
  const epRes = await fetch(`${API_BASE}/webhooks/svix`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!epRes.ok) {
    console.error(JSON.stringify({
      ok: false,
      reason: 'clerk_webhooks_endpoint_failed',
      status: epRes.status,
      body: await epRes.text(),
      hint: 'Verify webhook health from Clerk Dashboard → Webhooks → Logs.',
    }, null, 2))
    process.exit(2)
  }
  const data = await epRes.json() as { endpoints?: SvixEndpoint[] } | SvixEndpoint[]
  const endpoints = Array.isArray(data) ? data : (data.endpoints ?? [])

  const report = {
    ok: true,
    endpointCount: endpoints.length,
    endpoints: endpoints.map((e) => ({
      id: e.id,
      url: e.url,
      disabled: e.disabled ?? false,
      description: e.description ?? null,
    })),
    note: 'Delivery history lives in Clerk Dashboard → Webhooks → Logs. This script confirms endpoints are registered and not disabled.',
  }

  console.log(JSON.stringify(report, null, 2))

  const disabled = endpoints.filter((e) => e.disabled)
  if (disabled.length > 0) {
    console.error(`\nFAIL: ${disabled.length} disabled endpoint(s).`)
    process.exit(2)
  }
  if (endpoints.length === 0) {
    console.error('\nFAIL: No webhook endpoints registered.')
    process.exit(2)
  }
  console.log(`\nPASS: ${endpoints.length} endpoint(s) registered, none disabled.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
