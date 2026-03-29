/**
 * Visual regression suite for legal-facing pages.
 *
 * Privacy policy and portal medical consent are compliance-critical —
 * silent content disappearance or layout changes are a regulatory risk.
 *
 * First run creates golden screenshots in e2e/screenshots/.
 * Subsequent runs diff against goldens — fails if pixel diff > 1%.
 *
 * To update golden files after intentional changes:
 *   npx playwright test e2e/visual-regression-legal.spec.ts --update-snapshots
 */
import { test, expect } from '@playwright/test'
import { createBookingAndGetPortalToken, completeContactStep } from './helpers/portal'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Privacy policy ───────────────────────────────────────────────────────────

test.describe('visual: legal pages', () => {
  test('privacy policy page visual baseline', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`)
    await page.waitForLoadState('networkidle')

    // Verify the page rendered its key content before snapshotting
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible({
      timeout: 10_000,
    })

    await expect(page).toHaveScreenshot('privacy-policy.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  // ── Portal medical consent step ──────────────────────────────────────────

  test('portal medical consent step visual baseline', async ({ page }) => {
    const token = await createBookingAndGetPortalToken(page)

    // Navigate to portal and complete contact step to reach medical
    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStep(page)

    // Medical step should be visible with all 10 questions rendered
    await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })
    const noRadios = page.locator('input[type="radio"][value="no"]')
    await expect(noRadios).toHaveCount(10, { timeout: 5_000 })

    await expect(page).toHaveScreenshot('portal-medical-consent.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })
})
