#!/usr/bin/env tsx
// comments-ok: one-time Wave 4 migration script, kept for reproducibility, delete post-merge
import fs from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'ultraplan/canonical.json')
const raw = fs.readFileSync(FILE, 'utf-8')
const json = JSON.parse(raw) as {
  order: string[]
  stakeholders: Record<string, Record<string, unknown>>
  admin_venues?: Record<string, Record<string, unknown>>
}

const COUNTRY_MAP: Record<string, string> = {
  Thailand: 'TH', 'United States': 'US', USA: 'US',
  'United Kingdom': 'GB', UK: 'GB', Japan: 'JP', China: 'CN', Taiwan: 'TW',
  'South Korea': 'KR', France: 'FR', Germany: 'DE', Indonesia: 'ID',
  Malaysia: 'MY', Philippines: 'PH', Vietnam: 'VN', 'Viet Nam': 'VN',
}

function countryToISO(v: unknown): string {
  if (typeof v !== 'string') return ''
  if (/^[A-Z]{2}$/.test(v)) return v
  return COUNTRY_MAP[v] ?? v
}

function phoneToE164(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v) return typeof v === 'string' ? v : undefined
  return v.replace(/[\s\-()]/g, '')
}

function restructureLocation(block: Record<string, unknown>): void {
  if (!('placeName' in block) && !('country' in block)) return
  const placeName = block.placeName as string | undefined
  const country = countryToISO(block.country)
  block.address = {
    city: placeName ?? '',
    country,
  }
  delete block.placeName
  delete block.country
}

function collapsePair(block: Record<string, unknown>, field: string): void {
  const initKey = `${field}_initial`
  const completedKey = `${field}_completed`
  if (completedKey in block) {
    block[field] = block[completedKey]
    delete block[initKey]
    delete block[completedKey]
  }
}

const SLUG_MAP: Record<string, string> = {
  compressor_1: 'wkxhew',
  compressor_2: 'h0a5zl',
  equipment_manager_1: 'n7rq5j',
  equipment_manager_2: 'v8sr2p',
  equipment_manager_3: 'q9bz7r',
  boat_1: 'n7rq5j',
  boat_2: 'p5ky3w',
  instructor_1: 'ryan-clarke',
  instructor_2: 'li-ming',
  instructor_3: 'wei-chen',
  instructor_4: 'arisa-kanchanaburi',
  pool_1: 'n7rq5j',
  pool_2: 'z8mv4c',
  pool_3: 'b3wt9f',
  pool_4: 'g2hn6x',
  dive_center_1: 'n7rq5j',
  dive_center_2: 'q9bz7r',
  customer_1: 'mei-ling-chen',
  customer_2: 'jun-wang',
  customer_3: 'james-thompson',
  agent: 'ax3k7p',
}

const ROLE_BLOCK_KEY: Record<string, string> = {
  Compressor: 'compressors',
  Equipment: 'equipment',
  Boat: 'boats',
  Instructor: 'instructors',
  Pool: 'venues',
  DiveCenter: 'diveCenters',
  Agent: 'agents',
  Customer: 'customer',
}

for (const [id, entryRaw] of Object.entries(json.stakeholders)) {
  const entry = entryRaw as Record<string, unknown>
  const role = entry.role as string
  const blockKey = ROLE_BLOCK_KEY[role]

  if (entry.users) {
    const users = entry.users as Record<string, unknown>
    users.slug = SLUG_MAP[id] ?? id
    users.clerkUserIdHint = `user_seed_${id.replace(/_/g, '-')}`
    users.phone = phoneToE164(users.phone)
  }

  if (blockKey && entry[blockKey]) {
    const block = entry[blockKey] as Record<string, unknown>
    block.phone = phoneToE164(block.phone)
    if (role !== 'Customer') restructureLocation(block)
    collapsePair(block, 'gasMixes')
    collapsePair(block, 'vessels')
    collapsePair(block, 'teachingLanguages')
    collapsePair(block, 'associations')
    collapsePair(block, 'maxCapacity')
  }

  if (role === 'Customer' && entry.customer) {
    const cust = entry.customer as Record<string, unknown>
    if ('emergencyContact_completed' in cust) {
      cust.emergencyContact = cust.emergencyContact_completed
      delete cust.emergencyContact_initial
      delete cust.emergencyContact_completed
    }
    cust.phone = phoneToE164(cust.phone)
    if (cust.emergencyContact) {
      const ec = cust.emergencyContact as Record<string, unknown>
      ec.phone = phoneToE164(ec.phone)
    }
  }

  collapsePair(entry, 'inventoryOverrides')

  if (role !== 'Customer') {
    entry.clerkOrgIdHint = `org_seed_${id.replace(/_/g, '-')}`
  }
}

if (json.admin_venues) {
  for (const [, venueRaw] of Object.entries(json.admin_venues)) {
    const venue = venueRaw as Record<string, unknown>
    if (venue.venues) {
      restructureLocation(venue.venues as Record<string, unknown>)
    }
  }
}

fs.writeFileSync(FILE, JSON.stringify(json, null, 2) + '\n', 'utf-8')
console.log('canonical.json transformed.')
