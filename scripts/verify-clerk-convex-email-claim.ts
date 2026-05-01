#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'

const TEMPLATE_NAME = 'convex'
const REQUIRED_CLAIM = 'email'
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

async function main() {
  const res = await fetch(`${API_BASE}/jwt_templates`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!res.ok) {
    console.error(`listTemplates failed: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  const templates = (await res.json()) as Array<{ id: string; name: string; claims: Record<string, unknown> }>
  const template = templates.find((t) => t.name === TEMPLATE_NAME)
  if (!template) {
    console.error(`Template "${TEMPLATE_NAME}" not found. Run: npm run clerk:jwt-template`)
    process.exit(1)
  }
  const claims = template.claims ?? {}
  const hasEmail = REQUIRED_CLAIM in claims
  const claimValue = claims[REQUIRED_CLAIM]

  const report = {
    template: TEMPLATE_NAME,
    templateId: template.id,
    hasEmailClaim: hasEmail,
    emailClaimValue: claimValue ?? null,
    allClaims: Object.keys(claims),
  }
  console.log(JSON.stringify(report, null, 2))

  if (!hasEmail) {
    console.error(`\nFAIL: "${REQUIRED_CLAIM}" claim is missing from template "${TEMPLATE_NAME}"`)
    console.error('Add `email: "{{user.primary_email_address}}"` via Clerk dashboard or extend ensure-jwt-template.ts.')
    process.exit(2)
  }
  console.log(`\nPASS: Convex-facing Clerk token includes "${REQUIRED_CLAIM}" claim.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
