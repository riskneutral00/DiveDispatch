#!/usr/bin/env tsx
/**
 * Deletes orphaned E2E test users from Clerk.
 *
 * E2E tests create Clerk users with emails matching `e2e-creation-*@divedispatch.dev`.
 * When tests crash before `afterAll` cleanup, these users accumulate against Clerk's
 * development instance limit (100 users). This script removes them.
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_test_xxx npx tsx scripts/cleanup-e2e-users.ts
 *   npx tsx scripts/cleanup-e2e-users.ts          # uses .env.local
 *
 * Can be run manually or as part of batch processing.
 */

import { createClerkClient } from '@clerk/backend'
import { config } from 'dotenv'

config({ path: '.env.local' })

const E2E_EMAIL_PREFIX = 'e2e-creation-'

const clerkSecretKey = process.env.CLERK_SECRET_KEY
if (!clerkSecretKey) {
  console.error('CLERK_SECRET_KEY is not set. Set it or create .env.local.')
  process.exit(1)
}

const clerk = createClerkClient({ secretKey: clerkSecretKey })

async function main() {
  // Clerk's user list API supports email_address query filtering
  // We paginate through all users matching the E2E prefix
  let deleted = 0
  let offset = 0
  const limit = 100

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: users } = await clerk.users.getUserList({
      limit,
      offset,
      query: E2E_EMAIL_PREFIX,
    })

    if (users.length === 0) break

    for (const user of users) {
      const email = user.emailAddresses[0]?.emailAddress
      if (!email?.startsWith(E2E_EMAIL_PREFIX)) continue

      try {
        await clerk.users.deleteUser(user.id)
        deleted++
        console.log(`  deleted: ${email} (${user.id})`)
      } catch (err) {
        console.warn(`  failed to delete ${email}: ${err}`)
      }
    }

    // If we got fewer than limit, we've exhausted the list
    if (users.length < limit) break
    offset += limit
  }

  if (deleted === 0) {
    console.log('No orphaned E2E users found.')
  } else {
    console.log(`Cleaned up ${deleted} orphaned E2E user(s).`)
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
