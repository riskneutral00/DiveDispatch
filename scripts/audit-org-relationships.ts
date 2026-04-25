#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

const INVARIANT_LABELS: Record<string, string> = {
  '1': 'users.organizationId references existing organization',
  '2': 'userRoles.organizationId is set',
  '3': 'userRoles.organizationId === user.organizationId (sync)',
  '4': 'profile-table organizationId references existing organization',
  '5': 'no ghost seed orgs (clerkOrgId !~ /^seed_org_/)',
}

const INVARIANT_6_NOTE =
  'invariant 6 (personal_ + JWT split-brain): SKIPPED — server-side query has no JWT context'

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

async function main(): Promise<void> {
  const envLocal = readEnvLocal()
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? envLocal['NEXT_PUBLIC_CONVEX_URL']

  if (!convexUrl) {
    console.error('NEXT_PUBLIC_CONVEX_URL is required (set in .env.local or env)')
    process.exit(1)
  }

  const client = new ConvexHttpClient(convexUrl)

  const result = await client.query(api.admin.auditOrgRelationships.run, {})

  const { summary, violations, ok } = result

  console.log(
    `users=${summary.users} orgs=${summary.orgs} userRoles=${summary.roles}`,
  )
  console.log('')

  const violationsByInvariant = new Map<string, typeof violations>()
  for (const v of violations) {
    const arr = violationsByInvariant.get(v.invariant) ?? []
    arr.push(v)
    violationsByInvariant.set(v.invariant, arr)
  }

  for (const [code, label] of Object.entries(INVARIANT_LABELS)) {
    const failures = violationsByInvariant.get(code) ?? []
    if (failures.length === 0) {
      console.log(`✓ invariant ${code}: ${label}`)
    } else {
      console.log(`✗ invariant ${code}: ${label} — ${failures.length} violation(s)`)
      for (const f of failures) {
        console.log(`    ${f.detail}`)
      }
    }
  }
  console.log(`- ${INVARIANT_6_NOTE}`)
  console.log('')

  if (ok) {
    console.log('✓ all invariants pass')
    process.exit(0)
  } else {
    console.log(`✗ ${violations.length} violation(s) across ${violationsByInvariant.size} invariant(s)`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('audit-org-relationships failed:', err)
  process.exit(1)
})
