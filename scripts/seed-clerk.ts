#!/usr/bin/env tsx
/**
 * Creates Clerk users matching all seeded Convex stakeholders + instructors.
 * Idempotent: skips users that already exist (by email).
 * Pass --force to delete and recreate existing users.
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_test_xxx npx tsx scripts/seed-clerk.ts
 *   CLERK_SECRET_KEY=sk_test_xxx npx tsx scripts/seed-clerk.ts --force
 */

import { createClerkClient } from '@clerk/backend'
import { ALL_STAKEHOLDERS, type SeedUser } from '../convex/seedData'
import { ALL_INSTRUCTORS } from '../convex/seedInstructorData'

const SEED_PASSWORD = 'REDACTED'

const secretKey = process.env.CLERK_SECRET_KEY
if (!secretKey) {
  console.error('CLERK_SECRET_KEY environment variable is required')
  process.exit(1)
}

const clerk = createClerkClient({ secretKey })
const force = process.argv.includes('--force')

interface Result {
  created: string[]
  skipped: string[]
  deleted: string[]
  failed: { email: string; error: string }[]
}

async function seedUser(user: SeedUser, result: Result): Promise<void> {
  const { email, firstName, lastName } = user

  const existing = await clerk.users.getUserList({ emailAddress: [email] })

  if (existing.totalCount > 0) {
    if (force) {
      for (const u of existing.data) {
        await clerk.users.deleteUser(u.id)
        result.deleted.push(email)
      }
    } else {
      result.skipped.push(email)
      return
    }
  }

  await clerk.users.createUser({
    emailAddress: [email],
    password: SEED_PASSWORD,
    firstName,
    lastName,
    skipPasswordChecks: true,
  })
  result.created.push(email)
}

async function main(): Promise<void> {
  const users: SeedUser[] = [
    ...ALL_STAKEHOLDERS.map((s) => s.user),
    ...ALL_INSTRUCTORS.map((s) => s.user),
  ]

  console.log(`Seeding ${users.length} Clerk users${force ? ' (--force)' : ''}...`)

  const result: Result = { created: [], skipped: [], deleted: [], failed: [] }

  for (const user of users) {
    try {
      await seedUser(user, result)
      const status = result.created.includes(user.email)
        ? 'created'
        : result.skipped.includes(user.email)
          ? 'skipped'
          : 'deleted+created'
      console.log(`  ${user.email} — ${status}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.failed.push({ email: user.email, error: message })
      console.error(`  ${user.email} — FAILED: ${message}`)
    }
  }

  console.log(
    `\nDone. Created: ${result.created.length}, Skipped: ${result.skipped.length}, ` +
      `Deleted: ${result.deleted.length}, Failed: ${result.failed.length}`
  )

  if (result.failed.length > 0) {
    process.exit(1)
  }
}

main()
