import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from '../helpers/auth'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Open the booking overlay from the dashboard. */
async function openBookingWizard(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: customers step', () => {
  test('customer form validates required fields', async ({ page }) => {
    await signInAsDiveCenter(page)
    await openBookingWizard(page)

    // Next button should be disabled when no fields are filled
    const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await expect(nextBtn).toBeDisabled()
  })

  test('Next advances to Itinerary with valid data', async ({ page }) => {
    await signInAsDiveCenter(page)
    await openBookingWizard(page)

    // Fill name
    await page.getByLabel('Full name *').fill('Test Diver')

    // Fill email (default contact type)
    await page.locator('input[type="email"]').first().fill('testdiver@example.com')

    // Select English language
    await page.getByRole('button', { name: 'English' }).click()

    // Next should now be enabled
    const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await expect(nextBtn).toBeEnabled()

    // Advance to itinerary step
    await nextBtn.click()

    // Customer form fields are gone; itinerary step shows Activity picker
    await expect(page.getByLabel('Full name *')).not.toBeVisible()
    await expect(page.getByText('Activity')).toBeVisible({ timeout: 5_000 })
  })
})
