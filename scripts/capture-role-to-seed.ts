#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

type StakeholderRole =
  | 'DiveCenter'
  | 'Boat'
  | 'Venue'
  | 'Equipment'
  | 'Compressor'
  | 'Agent'
  | 'Instructor'
  | 'Liveaboard'
  | 'DiveResort'
  | 'DiveHostel'

const SEED_BLOCK_BY_ROLE: Record<StakeholderRole, string> = {
  DiveCenter: 'diveCenter',
  Boat: 'boat',
  Venue: 'venue',
  Equipment: 'equipment',
  Compressor: 'compressor',
  Agent: 'agent',
  Instructor: 'instructor',
  Liveaboard: 'liveaboard',
  DiveResort: 'diveResort',
  DiveHostel: 'diveHostel',
}

const USER_STRIP_KEYS = new Set([
  '_id',
  '_creationTime',
  'tokenIdentifier',
  'selectedThemeId',
  'savedThemeIds',
  'tcAcceptedAt',
  'tcVersion',
  'organizationId',
])

const PROFILE_STRIP_KEYS = new Set(['_id', '_creationTime', 'organizationId'])

const ORG_STRIP_KEYS = new Set(['_id', '_creationTime', 'clerkOrgId', 'createdAt', 'updatedAt'])

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

function parseArgs(argv: string[]): { slug: string; name?: string } {
  let slug: string | undefined
  let name: string | undefined
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) {
      slug = argv[i + 1]
      i++
    } else if (argv[i] === '--name' && argv[i + 1]) {
      name = argv[i + 1]
      i++
    }
  }
  if (!slug) {
    console.error('Usage: tsx scripts/capture-role-to-seed.ts --slug <user-slug> [--name PARKED_LABEL]')
    process.exit(1)
  }
  return { slug, name }
}

function stripKeys<T extends Record<string, unknown>>(obj: T, strip: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!strip.has(k) && v !== undefined) out[k] = v
  }
  return out
}

function deriveLabel(orgName: string | null, slug: string): string {
  const base = orgName ?? slug
  const upper = base
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `PARKED_${upper.length > 0 ? upper : slug.toUpperCase()}`
}

async function main(): Promise<void> {
  const { slug, name } = parseArgs(process.argv.slice(2))

  const envLocal = readEnvLocal()
  const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? envLocal['NEXT_PUBLIC_CONVEX_URL']
  if (!convexUrl) {
    console.error('NEXT_PUBLIC_CONVEX_URL is required (set in .env.local or env)')
    process.exit(1)
  }

  const client = new ConvexHttpClient(convexUrl)
  const raw = await client.query(api.seedExport.captureBySlug, { slug })

  const user = raw.user as Record<string, unknown>
  const organization = raw.organization as Record<string, unknown> | null
  const profiles = raw.profiles as Record<string, Record<string, unknown>>
  const roles = raw.roles as { role: StakeholderRole }[]

  const userLiteral = stripKeys(user, USER_STRIP_KEYS)

  const agentDoc = profiles['Agent']
  if (agentDoc && Array.isArray(agentDoc.customerLanguages)) {
    userLiteral.customerLanguages = agentDoc.customerLanguages
  }

  const literal: Record<string, unknown> = {
    user: userLiteral,
    roles: roles.map((r) => ({ role: r.role })),
  }

  for (const r of roles) {
    const block = SEED_BLOCK_BY_ROLE[r.role]
    if (!block) continue
    const doc = profiles[r.role]
    if (!doc) continue
    const cleaned = stripKeys(doc, PROFILE_STRIP_KEYS)
    if (r.role === 'Agent') delete cleaned.customerLanguages
    literal[block] = cleaned
  }

  const orgName = organization && typeof organization.name === 'string' ? organization.name : null
  const label = name ?? deriveLabel(orgName, slug)

  const body = JSON.stringify(literal, null, 2)
  const output = `export const ${label}: SeedStakeholder = ${body}\n`

  console.log(`// captured from live DB via scripts/capture-role-to-seed.ts`)
  console.log(`// slug: ${slug}`)
  if (organization) {
    const orgLiteral = stripKeys(organization, ORG_STRIP_KEYS)
    console.log(`// organization: ${JSON.stringify(orgLiteral)}`)
  }
  console.log(output)
}

main().catch((err) => {
  console.error('capture-role-to-seed failed:', err)
  process.exit(1)
})
