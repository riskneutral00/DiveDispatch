#!/usr/bin/env tsx
/**
 * Creates Clerk users matching all seeded Convex stakeholders + instructors,
 * then patches each Convex user record with the real Clerk tokenIdentifier.
 * Idempotent: skips users that already exist (by email).
 * Pass --force to update existing users in-place (preserves user IDs + sessions).
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_test_xxx npx tsx scripts/seed-clerk.ts
 *   CLERK_SECRET_KEY=sk_test_xxx npx tsx scripts/seed-clerk.ts --force
 */

import { createClerkClient } from '@clerk/backend'
import { readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { ALL_STAKEHOLDERS, type SeedUser } from '../convex/seedData'
import { ALL_INSTRUCTORS } from '../convex/seedInstructorData'

const SEED_PASSWORD = 'REDACTED'
const DELAY_MS = 500 // spacing between Clerk API calls to avoid rate limits
const MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Derive the Clerk JWT issuer from the publishable key.
// pk_test_BASE64 → base64decode → "domain$" → "https://domain"
function getClerkIssuer(publishableKey: string): string {
  const raw = publishableKey.replace(/^pk_(test|live)_/, '')
  const decoded = Buffer.from(raw, 'base64').toString('utf-8').replace(/\$+$/, '')
  return `https://${decoded}`
}

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

const publishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  envLocal['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']

if (!publishableKey) {
  console.error('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable is required')
  process.exit(1)
}

const clerkIssuer = getClerkIssuer(publishableKey)
const clerk = createClerkClient({ secretKey })
const force = process.argv.includes('--force')

interface Result {
  created: string[]
  skipped: string[]
  updated: string[]
  failed: { email: string; error: string }[]
}

/**
 * Delete Clerk users whose +clerk_test@divedispatch.dev email is not in the
 * current seed dataset. Only runs with --force. Never touches non-test accounts.
 */
async function pruneOrphanClerkUsers(seedEmails: Set<string>): Promise<number> {
  console.log('Pruning orphaned Clerk users...')
  let pruned = 0
  let offset = 0
  const PAGE = 100

  // Paginate through all Clerk users
  while (true) {
    const page = await clerk.users.getUserList({ limit: PAGE, offset })
    if (page.data.length === 0) break

    for (const user of page.data) {
      const testEmail = user.emailAddresses.find((e) =>
        e.emailAddress.includes('+clerk_test@divedispatch.dev')
      )
      if (!testEmail) continue // not a seed user — leave it alone
      if (seedEmails.has(testEmail.emailAddress)) continue // still in seed data

      await clerk.users.deleteUser(user.id)
      console.log(`  ${testEmail.emailAddress} — pruned (not in seed data)`)
      pruned++
      await sleep(DELAY_MS)
    }

    if (page.data.length < PAGE) break
    offset += PAGE
  }

  console.log(`Pruned ${pruned} orphaned Clerk user${pruned === 1 ? '' : 's'}.`)
  return pruned
}

// Returns the Clerk user ID (for patching Convex tokenIdentifier), or null on failure.
async function seedUser(user: SeedUser, result: Result): Promise<string | null> {
  const { email, firstName, lastName } = user

  // Also look up old email format (without +clerk_test) to handle migration
  const oldEmail = email.replace('+clerk_test', '')
  const emailsToCheck = email !== oldEmail ? [email, oldEmail] : [email]

  const existing = await clerk.users.getUserList({ emailAddress: emailsToCheck })

  if (existing.totalCount > 0) {
    if (force) {
      // Update in-place — preserves user ID so existing sessions survive
      const existingUser = existing.data[0]
      await clerk.users.updateUser(existingUser.id, {
        password: SEED_PASSWORD,
        firstName,
        lastName,
        skipPasswordChecks: true,
      })
      result.updated.push(email)
      return existingUser.id
    } else {
      result.skipped.push(email)
      return existing.data[0].id
    }
  }

  const created = await clerk.users.createUser({
    emailAddress: [email],
    password: SEED_PASSWORD,
    firstName,
    lastName,
    skipPasswordChecks: true,
  })
  result.created.push(email)
  return created.id
}

async function main(): Promise<void> {
  const users: SeedUser[] = [
    ...ALL_STAKEHOLDERS.map((s) => s.user),
    ...ALL_INSTRUCTORS.map((s) => s.user),
  ]

  const seedEmails = new Set(users.map((u) => u.email))

  if (force) {
    await pruneOrphanClerkUsers(seedEmails)
  }

  console.log(`Seeding ${users.length} Clerk users${force ? ' (--force)' : ''}...`)

  const result: Result = { created: [], skipped: [], updated: [], failed: [] }
  const patches: { email: string; tokenIdentifier: string }[] = []

  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    let clerkUserId: string | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        clerkUserId = await seedUser(user, result)
        break
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isRateLimit = message.includes('Too Many Requests') || message.includes('429')
        if (isRateLimit && attempt < MAX_RETRIES) {
          const backoff = DELAY_MS * Math.pow(2, attempt)
          console.log(`  ${user.email} — rate limited, retrying in ${backoff}ms (attempt ${attempt}/${MAX_RETRIES})`)
          await sleep(backoff)
        } else {
          result.failed.push({ email: user.email, error: message })
          console.error(`  ${user.email} — FAILED: ${message}`)
          break
        }
      }
    }

    if (clerkUserId) {
      patches.push({ email: user.email, tokenIdentifier: `${clerkIssuer}|${clerkUserId}` })
      const status = result.created.includes(user.email)
        ? 'created'
        : result.updated.includes(user.email)
          ? 'updated'
          : 'skipped'
      console.log(`  ${user.email} — ${status}`)
    }

    // Space out API calls to stay under Clerk rate limits
    if (i < users.length - 1) await sleep(DELAY_MS)
  }

  console.log(
    `\nDone. Created: ${result.created.length}, Updated: ${result.updated.length}, ` +
      `Skipped: ${result.skipped.length}, Failed: ${result.failed.length}`
  )

  if (result.failed.length > 0) {
    process.exit(1)
  }

  // Patch Convex users with real tokenIdentifiers so dev logins work immediately.
  if (patches.length > 0) {
    console.log(`\nPatching ${patches.length} Convex tokenIdentifiers...`)
    const spawnResult = spawnSync(
      'npx',
      ['convex', 'run', 'seed:patchTokenIdentifiers', JSON.stringify({ patches })],
      { stdio: 'inherit', encoding: 'utf-8' }
    )
    if (spawnResult.status !== 0) {
      console.error('Failed to patch Convex tokenIdentifiers')
      process.exit(1)
    }
    console.log('Convex tokenIdentifiers patched.')
  }
}

main()
