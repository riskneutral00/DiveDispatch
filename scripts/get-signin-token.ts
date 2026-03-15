#!/usr/bin/env tsx
/**
 * Generates a Clerk sign-in token for a seed user by slug.
 *
 * Usage:
 *   npm run dev:token -- <slug>
 *   npm run dev:token -- n7rq5j
 *
 * Then in the browser console:
 *   const s = await Clerk.client.signIn.create({ strategy: 'ticket', ticket: '<token>' })
 *   await Clerk.setActive({ session: s.createdSessionId })
 */

import { createClerkClient } from '@clerk/backend'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ALL_STAKEHOLDERS } from '../convex/seedData'
import { ALL_INSTRUCTORS } from '../convex/seedInstructorData'

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

const slug = process.argv[2]
if (!slug) {
  console.error('Usage: npm run dev:token -- <slug>')
  process.exit(1)
}

const allUsers = [
  ...ALL_STAKEHOLDERS.map((s) => s.user),
  ...ALL_INSTRUCTORS.map((s) => s.user),
]

const seedUser = allUsers.find((u) => u.slug === slug)
if (!seedUser) {
  console.error(`No seed user found with slug: ${slug}`)
  console.error(`Available slugs: ${allUsers.map((u) => u.slug).join(', ')}`)
  process.exit(1)
}

const clerk = createClerkClient({ secretKey })

async function main() {
  const users = await clerk.users.getUserList({ emailAddress: [seedUser!.email] })
  const clerkUser = users.data[0]

  if (!clerkUser) {
    console.error(`Clerk user not found for email: ${seedUser!.email}`)
    console.error('Run npm run seed:force:all to create Clerk users.')
    process.exit(1)
  }

  const token = await clerk.signInTokens.createSignInToken({
    userId: clerkUser.id,
    expiresInSeconds: 300,
  })

  console.log(`\nSign-in token for ${seedUser!.name} (${slug}):\n`)
  console.log(token.token)
  console.log(`\nPaste in browser console:`)
  console.log(`const s = await Clerk.client.signIn.create({ strategy: 'ticket', ticket: '${token.token}' })`)
  console.log(`await Clerk.setActive({ session: s.createdSessionId })`)
}

main()
