#!/usr/bin/env tsx

import { createClerkClient } from '@clerk/backend'
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ALL_STAKEHOLDERS } from '../convex/seedData'
import { ALL_INSTRUCTORS } from '../convex/seedData'

const ROLE_SLUGS: Record<string, string> = {
  'n7rq5j': 'dive-center',
  'q9bz7r': 'dive-center',
  'sirolo': 'dive-center',
  'ryan-clarke': 'instructor',
  'arisa-kanchanaburi': 'dive-master',
  'r5yz4q': 'agent',
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

async function main() {
  const slug = process.argv[2] || 'n7rq5j'
  const roleSlug = process.argv[3] || ROLE_SLUGS[slug]

  if (!roleSlug) {
    console.error(`Unknown slug: ${slug}`)
    console.error(`Available: ${Object.keys(ROLE_SLUGS).join(', ')}`)
    process.exit(1)
  }

  const envLocal = readEnvLocal()
  const secretKey = process.env.CLERK_SECRET_KEY ?? envLocal['CLERK_SECRET_KEY']
  if (!secretKey) {
    console.error('CLERK_SECRET_KEY not found')
    process.exit(1)
  }

  const allUsers = [
    ...ALL_STAKEHOLDERS.map((s) => s.user),
    ...ALL_INSTRUCTORS.map((s) => s.user),
  ]
  const seedUser = allUsers.find((u) => u.slug === slug)
  if (!seedUser) {
    console.error(`No seed user with slug: ${slug}`)
    process.exit(1)
  }

  const clerk = createClerkClient({ secretKey })
  const users = await clerk.users.getUserList({ emailAddress: [seedUser.email] })
  const clerkUser = users.data[0]
  if (!clerkUser) {
    console.error(`Clerk user not found for ${seedUser.email}. Run: npm run seed:force`)
    process.exit(1)
  }

  const tokenResult = await clerk.signInTokens.createSignInToken({
    userId: clerkUser.id,
    expiresInSeconds: 300,
  })
  const token = tokenResult.token

  console.error(`[clerk-signin] Token acquired for ${seedUser.name} (${slug})`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  try {
    const signInUrl = `http://localhost:3000/sign-in#/?__clerk_ticket=${token}`
    console.error(`[clerk-signin] Navigating to sign-in...`)
    await page.goto(signInUrl, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(3000) // wait-ok: Clerk ticket flow settles session cookies client-side after networkidle

    const dashboardUrl = `http://localhost:3000/${slug}/${roleSlug}/dashboard`
    console.error(`[clerk-signin] Navigating to dashboard: ${dashboardUrl}`)
    await page.goto(dashboardUrl, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(2000) // wait-ok: Clerk publishable-key hydration delay on dashboard mount

    const currentUrl = page.url()
    if (currentUrl.includes('/sign-in')) {
      console.error('[clerk-signin] FAILED: Redirected to /sign-in — session not set')
      process.exit(1)
    }
    if (currentUrl.includes('/sign-up')) {
      console.error('[clerk-signin] FAILED: Redirected to /sign-up — Convex user missing')
      process.exit(1)
    }

    const screenshotPath = join(tmpdir(), `clerk-signin-${slug}-${Date.now()}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false })

    console.log(screenshotPath)
    console.error(`[clerk-signin] Screenshot saved: ${screenshotPath}`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(`[clerk-signin] Fatal: ${err.message}`)
  process.exit(1)
})
