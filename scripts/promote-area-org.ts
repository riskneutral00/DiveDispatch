#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

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

function parseArgs(argv: string[]): { slug: string } {
  let slug: string | undefined
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) {
      slug = argv[i + 1]
      i++
    }
  }
  if (!slug) {
    console.error('Usage: tsx scripts/promote-area-org.ts --slug <org-slug>')
    process.exit(1)
  }
  return { slug }
}

async function main(): Promise<void> {
  const { slug } = parseArgs(process.argv.slice(2))

  const envLocal = readEnvLocal()
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? envLocal['NEXT_PUBLIC_CONVEX_URL']

  if (!convexUrl) {
    console.error('NEXT_PUBLIC_CONVEX_URL is required (set in .env.local or env)')
    process.exit(1)
  }

  const client = new ConvexHttpClient(convexUrl)

  const result = await client.mutation(api.admin.promoteAreaOrg.run, { slug })

  console.log(JSON.stringify(result, null, 2))
  console.log(`\n✓ Promoted '${result.name}' (${result.slug}) to area org`)
}

main().catch((err) => {
  console.error('promote-area-org failed:', err)
  process.exit(1)
})
