import { test, expect } from '@playwright/test'
import {
  signInAs,
  signInAsDiveCenter,
  signInAsInstructor,
  signInAsMultiRole,
  signInAsAgent,
} from './helpers/auth'
import { NICOLE, HUG_OCEAN, AMANDA } from './helpers/seed'
import { dashboardRoute, PUBLIC_ROUTES } from './helpers/routes'
import { checkAccessibility } from './helpers/accessibility'
import { captureConsoleErrors } from './helpers/console'

// ── Public pages ──────────────────────────────────────────────────────────────

test.describe('smoke: public pages', () => {
  test('landing page accessibility', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.landing)
    await page.waitForLoadState('networkidle')
    await checkAccessibility(page)
  })

  test('sign-in page accessibility', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.signIn)
    await page.waitForLoadState('domcontentloaded')
    // Wait for Clerk to render its root box before running accessibility checks
    await expect(page.locator('.cl-rootBox')).toBeVisible({ timeout: 10_000 })
    // Exclude Clerk's internal elements — we can't control their DOM
    await checkAccessibility(page, { exclude: ['.cl-rootBox'] })
  })

  test('portal expired page accessibility', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.portalExpired)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText('This link has expired')).toBeVisible({
      timeout: 10_000,
    })
    await checkAccessibility(page)
  })

})

// ── Auth redirects ─────────────────────────────────────────────────────────────
// Auth-dependent tests are quarantined in automated runs (Car/Backseat) because
// Clerk ticket auth fails in headless Playwright contexts. Set E2E_CLERK_AUTH=1
// to enable when running manually with a live Clerk session.

test.describe('smoke: auth redirects', () => {
  test.skip(!process.env.E2E_CLERK_AUTH, 'Clerk auth not configured — set E2E_CLERK_AUTH=1')
  test('authenticated user is redirected to dashboard', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('dashboard has no console errors', async ({ page }) => {
    const console = captureConsoleErrors(page)
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    // Wait for dashboard content to render instead of networkidle
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })
    // Ignore Clerk dev mode warning — it's expected in development
    console.assertNoErrors({ ignore: [/Clerk.*development/] })
  })

  test('dashboard has background layers', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    // Base + overlay + shell; skin art is .dashboard-calendar-backdrop (dashboard only)
    const bgBase = await page.locator('.bg-base').count()
    const bgOverlay = await page.locator('.bg-overlay').count()
    const calendarSkin = await page.locator('.dashboard-calendar-backdrop').count()
    expect(bgBase, 'Missing .bg-base layer — glass needs a full-screen base').toBeGreaterThan(0)
    expect(bgOverlay, 'Missing .bg-overlay layer — glass needs an overlay').toBeGreaterThan(0)
    expect(
      calendarSkin,
      'Missing .dashboard-calendar-backdrop — dashboard skin art',
    ).toBeGreaterThan(0)
  })

  test.skip(!process.env.E2E_CLERK_AUTH, 'Clerk auth not configured — set E2E_CLERK_AUTH=1')
  test('role-scoped dashboard accessibility', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({
      timeout: 10_000,
    })
    await page.waitForLoadState('domcontentloaded')
    await checkAccessibility(page, {
      exclude: ['.cl-rootBox', '[data-clerk-component]'],
    })
  })

  test('unauthenticated access to dashboard is redirected to sign-in', async ({ page }) => {
    await page.goto('/dive-center/nicole-dive-center/dashboard')
    await expect(page).toHaveURL(/sign-in/, { timeout: 10_000 })
  })
})

// ── Per-role dashboard smoke tests ────────────────────────────────────────────

test.describe('smoke: role dashboards', () => {
  test.skip(!process.env.E2E_CLERK_AUTH, 'Clerk auth not configured — set E2E_CLERK_AUTH=1')
  test('dashboard loads for DiveCenter', async ({ page }) => {
    await signInAsDiveCenter(page)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })
    await page.screenshot({
      path: 'e2e/screenshots/dive-center/dashboard.png',
      fullPage: true,
    })
  })

  test('dashboard loads for Instructor', async ({ page }) => {
    await signInAsInstructor(page)
    // Instructor may land on /dashboard then redirect to role-scoped path, or go to /account
    // Just verify the page renders some dashboard content
    await expect(page).toHaveURL(/dashboard|account/, { timeout: 15_000 })
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({
      path: 'e2e/screenshots/instructor/dashboard.png',
      fullPage: true,
    })
  })

  test('dashboard loads for multi-role operator (Hug Ocean)', async ({ page }) => {
    await signInAsMultiRole(page)
    const expectedPath = dashboardRoute(HUG_OCEAN.roleKey, HUG_OCEAN.slug)
    await expect(page).toHaveURL(new RegExp(expectedPath.replace(/[/]/g, '\\/')))
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })
    await page.screenshot({
      path: 'e2e/screenshots/multi-role/dashboard.png',
      fullPage: true,
    })
  })

  test('dashboard loads for Agent', async ({ page }) => {
    await signInAsAgent(page)
    const expectedPath = dashboardRoute(AMANDA.roleKey, AMANDA.slug)
    await expect(page).toHaveURL(new RegExp(expectedPath.replace(/[/]/g, '\\/')))
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })
    await page.screenshot({
      path: 'e2e/screenshots/agent/dashboard.png',
      fullPage: true,
    })
  })

})

// ── Booking wizard ────────────────────────────────────────────────────────────
// Booking creation now uses an overlay on the dashboard (booking-overlay.tsx).
// The /booking/new route was removed. Overlay smoke test lives in walkthrough specs.

// ── Portal ────────────────────────────────────────────────────────────────────

test.describe('smoke: portal', () => {
  test('portal expired page loads', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.portalExpired)
    await expect(page).toHaveURL(/portal\/expired/)
    await expect(page.getByText('This link has expired')).toBeVisible({ timeout: 10_000 })
    await page.screenshot({
      path: 'e2e/screenshots/portal/expired.png',
      fullPage: true,
    })
  })

  test('portal shows expired for bad token', async ({ page }) => {
    await page.goto('/portal/00000000-0000-0000-0000-000000000000')
    // Invalid token → Convex returns not_found → redirect to /portal/expired
    await expect(page).toHaveURL(/portal\/expired/, { timeout: 15_000 })
    await page.screenshot({
      path: 'e2e/screenshots/portal/bad-token.png',
      fullPage: true,
    })
  })

  // Valid portal token requires a live seeded booking in Draft state.
  // Skip until a stable seed token is confirmed.
  test.skip('portal loads with valid token', async () => {
    // TODO: use deterministicUUID('bl', 0) once seeded booking status is verified
  })
})
