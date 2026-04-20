#!/usr/bin/env tsx

import { createClerkClient } from '@clerk/backend'
import { readFileSync } from 'fs'
import { join } from 'path'

const DELAY_MS = 500
const PAGE = 100

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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

if (publishableKey.startsWith('pk_live_')) {
  console.error('REFUSED: pk_live_ detected. This script only runs against Clerk dev instances.')
  process.exit(1)
}

if (!publishableKey.startsWith('pk_test_')) {
  console.error(`REFUSED: unrecognized publishable key prefix. Expected pk_test_, got: ${publishableKey.slice(0, 10)}...`)
  process.exit(1)
}

const clerk = createClerkClient({ secretKey })
const execute = process.argv.includes('--yes')

async function listAllUsers(): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = []
  let offset = 0
  while (true) {
    const page = await clerk.users.getUserList({ limit: PAGE, offset })
    if (page.data.length === 0) break
    for (const u of page.data) {
      const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
      const email = primary?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? '(no email)'
      out.push({ id: u.id, email })
    }
    if (page.data.length < PAGE) break
    offset += PAGE
  }
  return out
}

async function listAllOrgs(): Promise<{ id: string; slug: string; name: string }[]> {
  const out: { id: string; slug: string; name: string }[] = []
  let offset = 0
  while (true) {
    const page = await clerk.organizations.getOrganizationList({ limit: PAGE, offset })
    if (page.data.length === 0) break
    for (const o of page.data) {
      out.push({ id: o.id, slug: o.slug ?? '(no-slug)', name: o.name })
    }
    if (page.data.length < PAGE) break
    offset += PAGE
  }
  return out
}

async function listAllInvitations(): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = []
  let offset = 0
  while (true) {
    const page = await clerk.invitations.getInvitationList({ limit: PAGE, offset })
    if (page.data.length === 0) break
    for (const inv of page.data) {
      out.push({ id: inv.id, email: inv.emailAddress })
    }
    if (page.data.length < PAGE) break
    offset += PAGE
  }
  return out
}

async function main(): Promise<void> {
  console.log(`Clerk instance: ${publishableKey.slice(0, 18)}... (dev)`)
  console.log(execute ? 'Mode: EXECUTE (--yes)\n' : 'Mode: DRY RUN (pass --yes to execute)\n')

  console.log('Enumerating...')
  const [users, orgs, invitations] = await Promise.all([
    listAllUsers(),
    listAllOrgs(),
    listAllInvitations(),
  ])

  console.log(`  Users: ${users.length}`)
  console.log(`  Organizations: ${orgs.length}`)
  console.log(`  Pending invitations: ${invitations.length}`)

  if (!execute) {
    console.log('\n--- Users ---')
    for (const u of users) console.log(`  ${u.email}`)
    console.log('\n--- Organizations ---')
    for (const o of orgs) console.log(`  ${o.slug}  (${o.name})`)
    console.log('\n--- Invitations ---')
    for (const inv of invitations) console.log(`  ${inv.email}`)
    console.log('\nDry run complete. Re-run with --yes to delete.')
    return
  }

  let deletedInvitations = 0
  let deletedOrgs = 0
  let deletedUsers = 0
  const failed: { kind: string; id: string; error: string }[] = []

  if (invitations.length > 0) {
    console.log(`\nRevoking ${invitations.length} invitation${invitations.length === 1 ? '' : 's'}...`)
    for (const inv of invitations) {
      try {
        await clerk.invitations.revokeInvitation(inv.id)
        deletedInvitations++
        console.log(`  ${inv.email} — revoked`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failed.push({ kind: 'invitation', id: inv.id, error: message })
        console.error(`  ${inv.email} — FAILED: ${message}`)
      }
      await sleep(DELAY_MS)
    }
  }

  if (orgs.length > 0) {
    console.log(`\nDeleting ${orgs.length} organization${orgs.length === 1 ? '' : 's'}...`)
    for (const o of orgs) {
      try {
        await clerk.organizations.deleteOrganization(o.id)
        deletedOrgs++
        console.log(`  ${o.slug} — deleted`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failed.push({ kind: 'organization', id: o.id, error: message })
        console.error(`  ${o.slug} — FAILED: ${message}`)
      }
      await sleep(DELAY_MS)
    }
  }

  if (users.length > 0) {
    console.log(`\nDeleting ${users.length} user${users.length === 1 ? '' : 's'}...`)
    for (const u of users) {
      try {
        await clerk.users.deleteUser(u.id)
        deletedUsers++
        console.log(`  ${u.email} — deleted`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        failed.push({ kind: 'user', id: u.id, error: message })
        console.error(`  ${u.email} — FAILED: ${message}`)
      }
      await sleep(DELAY_MS)
    }
  }

  console.log(
    `\nDone. Deleted ${deletedUsers} user${deletedUsers === 1 ? '' : 's'}, ` +
      `${deletedOrgs} organization${deletedOrgs === 1 ? '' : 's'}, ` +
      `${deletedInvitations} invitation${deletedInvitations === 1 ? '' : 's'}. ` +
      `Failed: ${failed.length}.`
  )

  if (failed.length > 0) {
    console.error('\nFailures:')
    for (const f of failed) console.error(`  ${f.kind} ${f.id}: ${f.error}`)
    process.exit(1)
  }
}

main()
