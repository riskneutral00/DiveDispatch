import type { Page } from '@playwright/test'
import { NICOLE, RYAN_CLARKE, WATER_PRO, COMPRESSOR_CHALONG, AMANDA } from './seed'

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

  const { token } = (await res.json()) as { token: string; url: string }

  // Navigate to the app's sign-in page with the Clerk ticket token.
  // Clerk's <SignIn> component picks up __clerk_ticket and processes it.
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  await page.goto(`${baseUrl}/sign-in#/?__clerk_ticket=${token}`)
  // Clerk processes the token and redirects to the app's after-sign-in URL
  await page.waitForURL('**/dashboard**', { timeout: 30_000 })
}

// ── Role-specific convenience helpers ─────────────────────────────────────────

/** Sign in as the primary DiveCenter test user (Nicole). */
export async function signInAsDiveCenter(page: Page): Promise<void> {
  await signInAs(page, NICOLE.email)
}

/** Sign in as the primary Instructor test user (Ryan Clarke). */
export async function signInAsInstructor(page: Page): Promise<void> {
  await signInAs(page, RYAN_CLARKE.email)
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

// ── Fresh sign-up helper (for creation tests) ────────────────────────────────

/**
 * Create a brand-new Clerk user, delete the webhook-created Convex record,
 * and sign in. The caller lands on whatever URL Clerk redirects to after
 * sign-in — typically /dashboard — with NO Convex user record, so navigating
 * to /account will show the setup wizard (role selection tiles).
 *
 * Returns a cleanup function that deletes the Clerk user when called.
 */
export async function signUpFresh(page: Page): Promise<{
  email: string
  clerkUserId: string
  cleanup: () => Promise<void>
}> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  if (!clerkSecretKey) throw new Error('CLERK_SECRET_KEY is not set')

  const siteUrl = getConvexSiteUrl()
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const timestamp = Date.now()
  const email = `e2e-creation-${timestamp}+clerk_test@divedispatch.dev`

  // 1. Create Clerk user via Backend API
  const createRes = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: [email],
      password: 'DiveDispatch-E2E-Xk9$mQ7!',
      first_name: 'E2E',
      last_name: 'Test',
    }),
  })
  if (!createRes.ok) {
    throw new Error(`Failed to create Clerk user: ${await createRes.text()}`)
  }
  const { id: clerkUserId } = (await createRes.json()) as { id: string }

  // 2. Wait for webhook to fire and create the Convex user
  await new Promise((r) => setTimeout(r, 3_000))

  // 3. Delete Convex user record so setup wizard appears on /account
  await page.request.post(`${siteUrl}/dev/delete-user`, {
    data: { email },
    headers: { 'Content-Type': 'application/json' },
  })

  // 4. Get sign-in token and navigate
  const tokenRes = await page.request.post(`${siteUrl}/dev/signin-token`, {
    data: { email },
    headers: { 'Content-Type': 'application/json' },
  })
  if (!tokenRes.ok()) {
    throw new Error(
      `dev/signin-token failed (${tokenRes.status()}): ${await tokenRes.text()}`,
    )
  }
  const { token } = (await tokenRes.json()) as { token: string }

  await page.goto(`${baseUrl}/sign-in#/?__clerk_ticket=${token}`)
  // Wait for Clerk to process the token — don't assume dashboard URL
  await page.waitForURL((url) => !url.href.includes('/sign-in'), {
    timeout: 30_000,
  })

  // 5. Cleanup function: delete the Clerk user (webhook will anonymise Convex record)
  const cleanup = async () => {
    await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    })
  }

  return { email, clerkUserId, cleanup }
}
