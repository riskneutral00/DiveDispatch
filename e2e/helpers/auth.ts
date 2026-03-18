import type { Page } from '@playwright/test'
import { NICOLE, JAMES, WATER_PRO, COMPRESSOR_CHALONG, AMANDA } from './seed'

/**
 * Derive the Convex HTTP actions base URL from the Convex cloud URL.
 * e.g. https://xxx.convex.cloud → https://xxx.convex.site
 */
function getConvexSiteUrl(): string {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  }
  return convexUrl.replace('.convex.cloud', '.convex.site')
}

/**
 * Sign in as a seeded user via the dev-only Clerk sign-in token endpoint.
 * Navigates the page to the Clerk-issued sign-in URL and waits for
 * the post-auth redirect to the dashboard.
 *
 * Only works when ENVIRONMENT !== 'production'.
 */
export async function signInAs(page: Page, email: string): Promise<void> {
  const siteUrl = getConvexSiteUrl()

  const res = await page.request.post(`${siteUrl}/dev/signin-token`, {
    data: { email },
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok()) {
    throw new Error(
      `dev/signin-token failed (${res.status()}): ${await res.text()}`,
    )
  }

  const { url } = (await res.json()) as { token: string; url: string }

  await page.goto(url)
  // Clerk processes the token and redirects to the app's after-sign-in URL
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
}

// ── Role-specific convenience helpers ─────────────────────────────────────────

/** Sign in as the primary DiveCenter test user (Nicole). */
export async function signInAsDiveCenter(page: Page): Promise<void> {
  await signInAs(page, NICOLE.email)
}

/** Sign in as the primary Instructor test user (James Cooper). */
export async function signInAsInstructor(page: Page): Promise<void> {
  await signInAs(page, JAMES.email)
}

/** Sign in as the primary Pool test user (Water Pro). */
export async function signInAsPool(page: Page): Promise<void> {
  await signInAs(page, WATER_PRO.email)
}

/** Sign in as the primary Compressor test user (Compressor Chalong). */
export async function signInAsCompressor(page: Page): Promise<void> {
  await signInAs(page, COMPRESSOR_CHALONG.email)
}

/** Sign in as the primary Agent test user (Amanda). */
export async function signInAsAgent(page: Page): Promise<void> {
  await signInAs(page, AMANDA.email)
}
