/**
 * Visual regression suite.
 *
 * First run creates golden screenshots in e2e/screenshots/.
 * Subsequent runs diff against goldens — fails if pixel diff > 1%.
 *
 * To update golden files after intentional UI changes:
 *   npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 */
import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from './helpers/auth'
import { NICOLE } from './helpers/seed'

// ── Public pages ──────────────────────────────────────────────────────────────

test.describe('visual: public pages', () => {
  test('landing page visual baseline', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('landing.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('sign-in page visual baseline', async ({ page }) => {
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('sign-in.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('portal expired page visual baseline', async ({ page }) => {
    await page.goto('/portal/expired')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('portal-expired.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })
})

// ── Authenticated pages ───────────────────────────────────────────────────────

test.describe('visual: authenticated pages', () => {
  test('DiveCenter dashboard visual baseline', async ({ page }) => {
    await signInAsDiveCenter(page)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await page.waitForLoadState('networkidle')
    // Mask dynamic content (dates, live counters) to avoid flaky diffs
    await expect(page).toHaveScreenshot('dive-center-dashboard.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [
        // Mask any elements that show live/dynamic data
        page.locator('time'),
        page.locator('[data-testid="live-counter"]'),
      ],
    })
  })
})
