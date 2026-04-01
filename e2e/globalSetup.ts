import { NICOLE } from './helpers/seed'

/**
 * Playwright globalSetup — runs once before all tests.
 * Verifies seed data is present so tests fail fast with a clear message
 * instead of cryptic 60s timeouts when the database hasn't been seeded.
 *
 * Set E2E_SKIP_SEED_CHECK=1 (e.g. CI public smoke against a deployment without
 * dev signin-token) to skip the Convex seed health check.
 */
export default async function globalSetup() {
  if (process.env.E2E_SKIP_SEED_CHECK === '1') {
    // eslint-disable-next-line no-console -- e2e diagnostics
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
