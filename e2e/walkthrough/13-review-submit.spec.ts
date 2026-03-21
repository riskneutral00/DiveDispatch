import { test, expect } from '@playwright/test'
import { signInAs } from '../helpers/auth'
import { NICOLE, futureDateString } from '../helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Run the full 3-step wizard: Customers → Itinerary → Review.
 * Returns when the Review step is visible ("Submit Booking" button is present).
 */
async function fillWizardToReview(
  page: import('@playwright/test').Page,
  opts: { diverName: string; diverEmail: string; startDate: string },
): Promise<void> {
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill(opts.diverName)
  await page.locator('input[type="email"]').first().fill(opts.diverEmail)
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: Itinerary — DSD with first available instructor
  await page.locator('select').first().selectOption('DSD')
  await page.locator('input[type="date"]').first().fill(opts.startDate)
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('select').filter({ hasText: /Select instructor/ })
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })

  const allOptions = instructorSelect.locator('option')
  const count = await allOptions.count()
  for (let i = 0; i < count; i++) {
    const val = await allOptions.nth(i).getAttribute('value')
    if (val && val !== '' && val !== '__external__') {
      await instructorSelect.selectOption(val)
      break
    }
  }

  await page.getByRole('button', { name: 'Next', exact: true }).click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: review and submit', () => {
  test('review step shows correct booking summary', async ({ page }) => {
    const startDate = futureDateString(65)

    await signInAs(page, NICOLE.email)
    await fillWizardToReview(page, {
      diverName: 'Review Diver',
      diverEmail: 'review@example.com',
      startDate,
    })

    // Review step: "Submit Booking" button is present
    await expect(page.getByRole('button', { name: 'Submit Booking' })).toBeVisible({ timeout: 10_000 })

    // Summary shows diver name
    await expect(page.getByText('Review Diver')).toBeVisible({ timeout: 5_000 })

    // Summary shows selected activity (DSD)
    await expect(page.getByText('DSD')).toBeVisible()
  })

  test('Submit Booking closes overlay and returns to dashboard', async ({ page }) => {
    const startDate = futureDateString(66)

    await signInAs(page, NICOLE.email)
    await fillWizardToReview(page, {
      diverName: 'Submit Diver',
      diverEmail: 'submit@example.com',
      startDate,
    })

    // Submit the booking
    await page.getByRole('button', { name: 'Submit Booking' }).click()

    // Overlay is gone — dashboard heading is visible
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })

    // Customer name field (wizard overlay) should no longer be visible
    await expect(page.getByLabel('Full name *')).not.toBeVisible()
  })
})
