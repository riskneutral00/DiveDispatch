#!/usr/bin/env tsx

import { createClerkClient } from '@clerk/backend'
import { readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { ALL_STAKEHOLDERS, type SeedUser } from '../convex/seedData'
import { ALL_INSTRUCTORS } from '../convex/seedInstructorData'
import {
  SEED_USER_TO_ORG_SLUG,
  SEED_ORG_NAME_BY_SLUG,
  SEED_CLERK_ORG_ID_HINTS,
} from '../convex/shared/seedSlugs.generated'

const SEED_PASSWORD = 'divedispatch123'
const DELAY_MS = 500 // spacing between Clerk API calls to avoid rate limits
const MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

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

interface OrgResult {
  created: string[]
  updated: string[]
  skipped: string[]
  pruned: number
  failed: { slug: string; error: string }[]
  slugToClerkId: Map<string, string>
}

async function pruneOrphanClerkUsers(seedEmails: Set<string>): Promise<number> {
  console.log('Pruning orphaned Clerk users...')
  let pruned = 0
  let offset = 0
  const PAGE = 100

  while (true) {
    const page = await clerk.users.getUserList({ limit: PAGE, offset })
    if (page.data.length === 0) break

    for (const user of page.data) {
      const devEmail = user.emailAddresses.find((e) =>
        e.emailAddress.endsWith('@divedispatch.dev')
      )
      if (!devEmail) continue

      await clerk.users.deleteUser(user.id)
      console.log(`  ${devEmail.emailAddress} — pruned (not in seed data)`)
      pruned++
      await sleep(DELAY_MS)
    }

    if (page.data.length < PAGE) break
    offset += PAGE
  }

  console.log(`Pruned ${pruned} orphaned Clerk user${pruned === 1 ? '' : 's'}.`)
  return pruned
}

async function pruneOrphanSeedOrgs(seedOrgSlugs: Set<string>): Promise<number> {
  console.log('Pruning orphaned seed Clerk orgs...')
  let pruned = 0
  let offset = 0
  const PAGE = 100
  while (true) {
    const page = await clerk.organizations.getOrganizationList({ limit: PAGE, offset })
    if (page.data.length === 0) break
    for (const org of page.data) {
      const tag = (org.publicMetadata as Record<string, unknown>)?.seedTag
      if (tag !== 'dd_seed') continue
      if (seedOrgSlugs.has(org.slug ?? '')) continue
      await clerk.organizations.deleteOrganization(org.id)
      console.log(`  ${org.slug} — pruned (not in seed data)`)
      pruned++
      await sleep(DELAY_MS)
    }
    if (page.data.length < PAGE) break
    offset += PAGE
  }
  console.log(`Pruned ${pruned} orphaned seed Clerk org${pruned === 1 ? '' : 's'}.`)
  return pruned
}

async function seedOrg(
  orgSlug: string,
  orgName: string,
  createdByClerkUserId: string,
  result: OrgResult,
): Promise<string | null> {
  const existing = await clerk.organizations.getOrganizationList({ query: orgSlug, limit: 10 })
  const match = existing.data.find((o) => o.slug === orgSlug)
  if (match) {
    if (force) {
      await clerk.organizations.updateOrganization(match.id, {
        name: orgName,
        publicMetadata: { seedTag: 'dd_seed' },
      })
      result.updated.push(orgSlug)
      return match.id
    }
    result.skipped.push(orgSlug)
    return match.id
  }
  const created = await clerk.organizations.createOrganization({
    name: orgName,
    slug: orgSlug,
    createdBy: createdByClerkUserId,
    publicMetadata: { seedTag: 'dd_seed' },
  })
  result.created.push(orgSlug)
  return created.id
}

async function ensureMembership(
  orgId: string,
  userId: string,
  role: string,
): Promise<void> {
  const existing = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 })
  const match = existing.data.find((m) => m.publicUserData?.userId === userId)
  if (match) {
    if (match.role !== role) {
      await clerk.organizations.updateOrganizationMembership({ organizationId: orgId, userId, role })
    }
    return
  }
  await clerk.organizations.createOrganizationMembership({ organizationId: orgId, userId, role })
}

async function seedUser(user: SeedUser, result: Result): Promise<string | null> {
  const { email, firstName, lastName } = user

  const oldEmail = email.replace('+clerk_test', '')
  const emailsToCheck = email !== oldEmail ? [email, oldEmail] : [email]

  const existing = await clerk.users.getUserList({ emailAddress: emailsToCheck })

  if (existing.totalCount > 0) {
    if (force) {
      const existingUser = existing.data[0]
      await clerk.users.updateUser(existingUser.id, {
        password: SEED_PASSWORD,
        firstName,
        lastName,
        skipPasswordChecks: true,
        publicMetadata: { slug: user.slug, role: user.role },
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
    publicMetadata: { slug: user.slug, role: user.role },
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

    if (i < users.length - 1) await sleep(DELAY_MS)
  }

  console.log(
    `\nDone. Created: ${result.created.length}, Updated: ${result.updated.length}, ` +
      `Skipped: ${result.skipped.length}, Failed: ${result.failed.length}`
  )

  if (result.failed.length > 0) {
    process.exit(1)
  }

  const emailToClerkId = new Map<string, string>()
  for (const p of patches) {
    const clerkId = p.tokenIdentifier.split('|')[1]
    emailToClerkId.set(p.email, clerkId)
  }
  const userSlugToClerkId = new Map<string, string>()
  for (const u of users) {
    const clerkId = emailToClerkId.get(u.email)
    if (clerkId) userSlugToClerkId.set(u.slug, clerkId)
  }

  const orgResult: OrgResult = { created: [], updated: [], skipped: [], pruned: 0, failed: [], slugToClerkId: new Map() }
  const seedOrgSlugs = new Set(Object.keys(SEED_CLERK_ORG_ID_HINTS))

  if (force) {
    orgResult.pruned = await pruneOrphanSeedOrgs(seedOrgSlugs)
  }

  console.log(`\nSeeding ${seedOrgSlugs.size} Clerk orgs${force ? ' (--force)' : ''}...`)
  const userToOrg = SEED_USER_TO_ORG_SLUG as Record<string, string>
  const orgSlugToAdminUserSlug = new Map<string, string>()
  for (const [userSlug, orgSlug] of Object.entries(userToOrg)) {
    if (!orgSlugToAdminUserSlug.has(orgSlug)) {
      orgSlugToAdminUserSlug.set(orgSlug, userSlug)
    }
  }

  const orgNames = SEED_ORG_NAME_BY_SLUG as Record<string, string>
  for (const orgSlug of seedOrgSlugs) {
    const adminUserSlug = orgSlugToAdminUserSlug.get(orgSlug)
    const createdBy = adminUserSlug ? userSlugToClerkId.get(adminUserSlug) : undefined
    if (!createdBy) {
      console.error(`  ${orgSlug} — SKIPPED (no admin user found in seeded users)`)
      orgResult.failed.push({ slug: orgSlug, error: 'no admin user' })
      continue
    }
    const orgName = orgNames[orgSlug] ?? orgSlug
    try {
      const clerkOrgId = await seedOrg(orgSlug, orgName, createdBy, orgResult)
      if (clerkOrgId) {
        orgResult.slugToClerkId.set(orgSlug, clerkOrgId)
        const status = orgResult.created.includes(orgSlug) ? 'created' : orgResult.updated.includes(orgSlug) ? 'updated' : 'skipped'
        console.log(`  ${orgSlug} (${orgName}) — ${status}`)
      }
      await sleep(DELAY_MS)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      orgResult.failed.push({ slug: orgSlug, error: message })
      console.error(`  ${orgSlug} — FAILED: ${message}`)
    }
  }

  console.log(`\nOrgs — Created: ${orgResult.created.length}, Updated: ${orgResult.updated.length}, Skipped: ${orgResult.skipped.length}, Pruned: ${orgResult.pruned}, Failed: ${orgResult.failed.length}`)

  console.log(`\nCreating org memberships...`)
  let membershipCount = 0
  for (const [userSlug, orgSlug] of Object.entries(userToOrg)) {
    const clerkUserId = userSlugToClerkId.get(userSlug)
    const clerkOrgId = orgResult.slugToClerkId.get(orgSlug)
    if (!clerkUserId || !clerkOrgId) {
      console.error(`  ${userSlug} -> ${orgSlug} — SKIPPED (missing clerk ids)`)
      continue
    }
    try {
      await ensureMembership(clerkOrgId, clerkUserId, 'org:admin')
      membershipCount++
      await sleep(DELAY_MS / 2)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  ${userSlug} -> ${orgSlug} — FAILED: ${message}`)
    }
  }
  console.log(`Memberships established: ${membershipCount}`)

  if (orgResult.failed.length > 0) process.exit(1)

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
