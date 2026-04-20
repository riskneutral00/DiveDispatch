#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'

const CANONICAL_PATH = path.join(process.cwd(), 'ultraplan/canonical.json')
const OUTPUT_PATH = path.join(process.cwd(), 'convex/shared/seedSlugs.generated.ts')

type Entry = {
  role: string
  clerkOrgIdHint?: string
  users?: { slug?: string; clerkUserIdHint?: string }
}

const raw = fs.readFileSync(CANONICAL_PATH, 'utf-8')
const canonical = JSON.parse(raw) as {
  order: string[]
  stakeholders: Record<string, Entry>
}

const ORG_SLUGS: Record<string, string> = {
  compressor_1: 'wkxhew',
  compressor_2: 'h0a5zl',
  equipment_manager_1: 'n7rq5j',
  equipment_manager_2: 'v8sr2p',
  equipment_manager_3: 'q9bz7r',
  boat_1: 'n7rq5j',
  boat_2: 'p5ky3w',
  instructor_1: 'geprkx',
  instructor_2: 'lkp3zm',
  instructor_3: 'wc8qg2',
  instructor_4: 'z039zt',
  pool_1: 'n7rq5j',
  pool_2: 'z8mv4c',
  pool_3: 'b3wt9f',
  pool_4: 'g2hn6x',
  dive_center_1: 'n7rq5j',
  dive_center_2: 'q9bz7r',
  agent: 'ax3k7p',
}

const userSlugByEntry: Record<string, string> = {}
const orgSlugByEntry: Record<string, string> = {}
const userHintBySlug: Record<string, string> = {}
const orgHintBySlug: Record<string, string> = {}
const userSlugToOrgSlug: Record<string, string> = {}
const orgSlugToOrgName: Record<string, string> = {}

const ENTRY_NAMES: Record<string, string> = {
  compressor_1: 'Scuba Market Thailand',
  compressor_2: 'Compressor Shop Chalong Pier',
  equipment_manager_1: 'Hug Ocean',
  equipment_manager_2: 'Scuba Revolution Phuket',
  equipment_manager_3: 'Nicole Dive Center',
  boat_1: 'Hug Ocean',
  boat_2: 'Mandarin Queen',
  instructor_1: 'Ryan Clarke',
  instructor_2: 'Li Ming',
  instructor_3: 'Wei Chen',
  instructor_4: 'Arisa Kanchanaburi',
  pool_1: 'Hug Ocean',
  pool_2: 'Neptune',
  pool_3: 'Water Pro',
  pool_4: 'Shark Bites',
  dive_center_1: 'Hug Ocean',
  dive_center_2: 'Nicole Dive Center',
  agent: 'Alex Walker Dive Travel',
}



for (const id of canonical.order) {
  const entry = canonical.stakeholders[id]
  if (!entry) throw new Error(`gen-seed-slugs: missing stakeholder ${id}`)

  const userSlug = entry.users?.slug
  if (userSlug) {
    userSlugByEntry[id] = userSlug
    if (!userHintBySlug[userSlug]) {
      userHintBySlug[userSlug] = `user_seed_${userSlug}`
    }
  }

  if (entry.role !== 'Customer') {
    const orgSlug = ORG_SLUGS[id]
    if (!orgSlug) {
      throw new Error(
        `gen-seed-slugs: missing ORG_SLUGS entry for ${id} (role=${entry.role}). ` +
          `Update scripts/gen-seed-slugs.ts ORG_SLUGS map.`,
      )
    }
    orgSlugByEntry[id] = orgSlug
    if (!orgHintBySlug[orgSlug]) {
      orgHintBySlug[orgSlug] = `org_seed_${orgSlug}`
    }
    if (userSlug && !userSlugToOrgSlug[userSlug]) {
      userSlugToOrgSlug[userSlug] = orgSlug
    }
    if (!orgSlugToOrgName[orgSlug]) {
      orgSlugToOrgName[orgSlug] = ENTRY_NAMES[id] ?? orgSlug
    }
  }
}

function emitRecord(
  name: string,
  record: Record<string, string>,
  sorter: (a: string, b: string) => number,
): string {
  const entries = Object.entries(record)
    .sort(([a], [b]) => sorter(a, b))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n')
  return `export const ${name} = {\n${entries}\n} as const`
}

const byCanonicalOrder = (a: string, b: string): number =>
  canonical.order.indexOf(a) - canonical.order.indexOf(b)
const alpha = (a: string, b: string): number => a.localeCompare(b)

const content = [
  '// @generated — do not edit. Run `npm run gen:seed-slugs` to regenerate from ultraplan/canonical.json.',
  '// comments-ok: generated-file marker',
  '',
  emitRecord('SEED_USER_SLUGS_BY_ENTRY', userSlugByEntry, byCanonicalOrder),
  '',
  emitRecord('SEED_ORG_SLUGS_BY_ENTRY', orgSlugByEntry, byCanonicalOrder),
  '',
  emitRecord('SEED_CLERK_USER_ID_HINTS', userHintBySlug, alpha),
  '',
  emitRecord('SEED_CLERK_ORG_ID_HINTS', orgHintBySlug, alpha),
  '',
  emitRecord('SEED_USER_TO_ORG_SLUG', userSlugToOrgSlug, alpha),
  '',
  emitRecord('SEED_ORG_NAME_BY_SLUG', orgSlugToOrgName, alpha),
  '',
  'export type SeedStakeholderId = keyof typeof SEED_USER_SLUGS_BY_ENTRY',
  'export type SeedOrgStakeholderId = keyof typeof SEED_ORG_SLUGS_BY_ENTRY',
  'export type SeedUserSlug = keyof typeof SEED_CLERK_USER_ID_HINTS',
  'export type SeedOrgSlug = keyof typeof SEED_CLERK_ORG_ID_HINTS',
  '',
].join('\n')

fs.writeFileSync(OUTPUT_PATH, content, 'utf-8')
console.log(`Wrote ${OUTPUT_PATH}`)
console.log(`  ${Object.keys(userSlugByEntry).length} user slugs across entries`)
console.log(`  ${Object.keys(orgSlugByEntry).length} org slugs across entries`)
console.log(`  ${Object.keys(userHintBySlug).length} unique users → clerk hints`)
console.log(`  ${Object.keys(orgHintBySlug).length} unique orgs → clerk hints`)
