import { test, expect } from '@playwright/test'
import {
  signInAs,
  signInAsDiveCenter,
  signInAsInstructor,
  signInAsPool,
  signInAsCompressor,
  signInAsAgent,
} from './helpers/auth'
import { NICOLE, JAMES, WATER_PRO, COMPRESSOR_CHALONG, AMANDA } from './helpers/seed'
import { dashboardRoute, PUBLIC_ROUTES, AUTH_ROUTES } from './helpers/routes'
import { checkAccessibility } from './helpers/accessibility'
import { captureConsoleErrors } from './helpers/console'

// ── Public pages ──────────────────────────────────────────────────────────────

test.describe('smoke: public pages', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.landing)
    await expect(page).toHaveTitle(/DiveDispatch/i)
  })

  test('landing page accessibility', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.landing)
    await page.waitForLoadState('networkidle')
    await checkAccessibility(page)
  })

  test('sign-in page is reachable', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.signIn)
    await expect(page).not.toHaveURL(/404/)
    await expect(page).not.toHaveURL(/\/dashboard/)
  })

  test('sign-in page accessibility', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.signIn)
    await page.waitForLoadState('networkidle')
    // Exclude Clerk's internal elements — we can't control their DOM
    await checkAccessibility(page, { exclude: ['.cl-rootBox'] })
  })

  test('help page loads', async ({ page }) => {
    await signInAsDiveCenter(page)
    await page.goto(AUTH_ROUTES.help)
    await expect(page).not.toHaveURL(/sign-in/)
    await expect(page).toHaveURL(/help/)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'e2e/screenshots/help/help.png', fullPage: true })
  })
})

// ── Auth redirects ─────────────────────────────────────────────────────────────

test.describe('smoke: auth redirects', () => {
  test('authenticated user is redirected to dashboard', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await expect(page.getByText('DiveCenter Dashboard').or(page.getByText('Dashboard'))).toBeVisible({
      timeout: 10_000,
    })
  })

  test('dashboard has no console errors', async ({ page }) => {
    const console = captureConsoleErrors(page)
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await page.waitForLoadState('networkidle')
    // Ignore Clerk dev mode warning — it's expected in development
    console.assertNoErrors({ ignore: [/Clerk.*development/] })
  })

  test('dashboard has background layers', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    // Every authenticated page must have the 3-layer background stack
    const bgImage = await page.locator('.bg-image').count()
    const bgOverlay = await page.locator('.bg-overlay').count()
    expect(bgImage, 'Missing .bg-image layer — glass needs a background').toBeGreaterThan(0)
    expect(bgOverlay, 'Missing .bg-overlay layer — glass needs an overlay').toBeGreaterThan(0)
  })

  test('unauthenticated access to dashboard is redirected to sign-in', async ({ page }) => {
    await page.goto('/dive-center/nicole-dive-center/dashboard')
    await expect(page).toHaveURL(/sign-in/, { timeout: 10_000 })
  })
})

// ── Per-role dashboard smoke tests ────────────────────────────────────────────

test.describe('smoke: role dashboards', () => {
  test('dashboard loads for DiveCenter', async ({ page }) => {
    await signInAsDiveCenter(page)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'e2e/screenshots/dive-center/dashboard.png',
      fullPage: true,
    })
  })

  test('dashboard loads for Instructor', async ({ page }) => {
    await signInAsInstructor(page)
    const expectedPath = dashboardRoute(JAMES.roleKey, JAMES.slug)
    await expect(page).toHaveURL(new RegExp(expectedPath.replace(/[/]/g, '\\/')))
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'e2e/screenshots/instructor/dashboard.png',
      fullPage: true,
    })
  })

  test('dashboard loads for Pool', async ({ page }) => {
    await signInAsPool(page)
    const expectedPath = dashboardRoute(WATER_PRO.roleKey, WATER_PRO.slug)
    await expect(page).toHaveURL(new RegExp(expectedPath.replace(/[/]/g, '\\/')))
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'e2e/screenshots/pool/dashboard.png',
      fullPage: true,
    })
  })

  test('dashboard loads for Compressor', async ({ page }) => {
    await signInAsCompressor(page)
    const expectedPath = dashboardRoute(COMPRESSOR_CHALONG.roleKey, COMPRESSOR_CHALONG.slug)
    await expect(page).toHaveURL(new RegExp(expectedPath.replace(/[/]/g, '\\/')))
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'e2e/screenshots/compressor/dashboard.png',
      fullPage: true,
    })
  })

  test('dashboard loads for Agent', async ({ page }) => {
    await signInAsAgent(page)
    const expectedPath = dashboardRoute(AMANDA.roleKey, AMANDA.slug)
    await expect(page).toHaveURL(new RegExp(expectedPath.replace(/[/]/g, '\\/')))
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'e2e/screenshots/agent/dashboard.png',
      fullPage: true,
    })
  })

  // Boat, Equipment, DiveMaster have no standalone seed users.
  // These tests are skipped until seed data is added for those roles.
  test.skip('dashboard loads for Boat', async () => {
    // TODO: add Boat seed user (primary role: Boat)
  })

  test.skip('dashboard loads for Equipment', async () => {
    // TODO: add Equipment seed user (primary role: Equipment)
  })

  test.skip('dashboard loads for DiveMaster', async () => {
    // TODO: add DiveMaster seed user (primary role: DiveMaster)
  })
})

// ── Booking wizard ────────────────────────────────────────────────────────────

test.describe('smoke: booking wizard', () => {
  test('booking wizard page loads', async ({ page }) => {
    await signInAsDiveCenter(page)
    await page.goto(AUTH_ROUTES.bookingNew)
    await expect(page).not.toHaveURL(/sign-in/)
    // Wait for wizard to initialize (spinner or form visible)
    await page.waitForLoadState('networkidle')
    await page.screenshot({
      path: 'e2e/screenshots/booking/new.png',
      fullPage: true,
    })
  })
})

// ── Portal ────────────────────────────────────────────────────────────────────

test.describe('smoke: portal', () => {
  test('portal expired page loads', async ({ page }) => {
    await page.goto(PUBLIC_ROUTES.portalExpired)
    await expect(page).toHaveURL(/portal\/expired/)
    await expect(page.getByText('This link has expired')).toBeVisible({ timeout: 10_000 })
    await page.waitForLoadState('networkidle')
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
