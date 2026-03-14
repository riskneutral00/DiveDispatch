import type { Page } from '@playwright/test'

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
