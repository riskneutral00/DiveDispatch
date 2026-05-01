#!/usr/bin/env tsx

import { ConvexHttpClient } from 'convex/browser'
import { readFileSync } from 'fs'
import { join } from 'path'
import { api, internal } from '../convex/_generated/api'

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
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? envLocal['NEXT_PUBLIC_CONVEX_URL']
const adminKey = process.env.CONVEX_ADMIN_KEY ?? envLocal['CONVEX_ADMIN_KEY']

if (!convexUrl) {
  console.error('NEXT_PUBLIC_CONVEX_URL required')
  process.exit(1)
}
if (!adminKey) {
  console.error('CONVEX_ADMIN_KEY required (deployment-scoped admin key for internal mutations)')
  process.exit(1)
}

const args = process.argv.slice(2)
const mode: 'dry' | 'write' = args.includes('--write') ? 'write' : 'dry'

async function main() {
  const client = new ConvexHttpClient(convexUrl!)
  ;(client as unknown as { setAdminAuth: (key: string) => void }).setAdminAuth(adminKey!)

  const audit = await client.query((internal as unknown as { backfill: { identityCanonical: { audit: unknown } } }).backfill.identityCanonical.audit as never, {})

  console.log('=== AUDIT (read-only) ===')
  console.log(JSON.stringify(audit, null, 2))

  if (mode === 'dry') {
    console.log('\n[dry] Would run backfillCanonicalLocales with dryRun=true (no writes).')
    const result = await client.mutation(
      (internal as unknown as { backfill: { identityCanonical: { backfillCanonicalLocales: unknown } } }).backfill.identityCanonical.backfillCanonicalLocales as never,
      { dryRun: true } as never,
    )
    console.log(JSON.stringify(result, null, 2))
    console.log('\nDRY-RUN complete. No data written.')
    return
  }

  console.log('\n=== WRITE MODE: applying backfill ===')
  const result = await client.mutation(
    (internal as unknown as { backfill: { identityCanonical: { backfillCanonicalLocales: unknown } } }).backfill.identityCanonical.backfillCanonicalLocales as never,
    { dryRun: false } as never,
  )
  console.log(JSON.stringify(result, null, 2))

  console.log('\n=== POST-WRITE AUDIT ===')
  const postAudit = await client.query((internal as unknown as { backfill: { identityCanonical: { audit: unknown } } }).backfill.identityCanonical.audit as never, {})
  console.log(JSON.stringify(postAudit, null, 2))
}

void api
main().catch((err) => {
  console.error(err)
  process.exit(1)
})
