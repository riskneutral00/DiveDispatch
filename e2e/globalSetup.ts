import { NICOLE } from './helpers/seed'

/**
 * Playwright globalSetup — runs once before all tests.
 * Verifies seed data is present so tests fail fast with a clear message
 * instead of cryptic 60s timeouts when the database hasn't been seeded.
 */
export default async function globalSetup() {
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
