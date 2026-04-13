import { clerkSetup } from '@clerk/testing/playwright'
import { NICOLE } from './helpers/seed'

export default async function globalSetup() {
  await clerkSetup()

  if (process.env.E2E_SKIP_SEED_CHECK === '1') {
    console.warn('[e2e] E2E_SKIP_SEED_CHECK=1 — skipping Convex seed health check')
    return
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  const siteUrl = convexUrl.replace('.convex.cloud', '.convex.site')

  const res = await fetch(`${siteUrl}/dev/signin-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: NICOLE.email }),
  })

  if (!res.ok) {
    throw new Error(
      `E2E seed health check failed — NICOLE not found in database.\n` +
      `Run: npm run seed:force\n` +
      `(${res.status}: ${await res.text()})`,
    )
  }
}
