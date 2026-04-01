import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { HUG_OCEAN } from './helpers/seed'

test.describe('Hug Ocean Login', () => {
  test('should log into Hug Ocean dashboard', async ({ page }) => {
    // 1. Sign in as Hug Ocean
    await signInAs(page, HUG_OCEAN.email)

    // 2. Verify redirection to dashboard
    const dashboardRegex = new RegExp(HUG_OCEAN.dashboardPath.replace(/[/]/g, '\\/'))
    await expect(page).toHaveURL(dashboardRegex, { timeout: 30_000 })

    // 3. Verify core dashboard elements are visible
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="booking-calendar"]')).toBeVisible({ timeout: 10_000 })

    // 4. Take a screenshot for manual verification
    await page.screenshot({ path: 'e2e/screenshots/hug-ocean-dashboard.png', fullPage: true })

    // 5. Keep the browser open for manual use (local only; CI would hang)
    if (!process.env.CI) {
      test.setTimeout(0)
      await page.waitForEvent('close')
    }
  })
})
