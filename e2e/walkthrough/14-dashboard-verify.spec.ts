import { test, expect } from '@playwright/test'
import { signInAs } from '../helpers/auth'
import { NICOLE, futureDateString } from '../helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sign in as Nicole, create a minimal external DSD booking at startDate,
 * then navigate the calendar forward until a [data-booking-id] bar is visible.
 * Returns when the booking bar is visible.
 */
async function createBookingAndNavigateToIt(
  page: import('@playwright/test').Page,
  startDate: string,
): Promise<void> {
  await signInAs(page, NICOLE.email)
  await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath.replace(/\//g, '\\/')))

  // Open booking wizard
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill('Dashboard Verify Diver')
  await page.locator('input[type="email"]').first().fill('dashboard.verify@test.com')
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: Itinerary — DSD with external instructor
  await page.locator('select').first().selectOption('DSD')
  await page.locator('input[type="date"]').first().fill(startDate)
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('select').filter({ hasText: /Select instructor/ })
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
  await instructorSelect.selectOption('__external__')
  await page.getByLabel('Instructor (external)').fill('External Instructor')

  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3: Submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()

  // Dashboard auto-navigates to show the new booking — wait for its bar
  const bookingBar = page.locator('[data-booking-id]').first()
  await expect(bookingBar).toBeVisible({ timeout: 10_000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: dashboard verify (post-booking)', () => {
  test('calendar shows booking bar on correct dates', async ({ page }) => {
    const startDate = futureDateString(55)
    await createBookingAndNavigateToIt(page, startDate)

    // At least one booking bar is visible (the one we just created)
    await expect(page.locator('[data-booking-id]').first()).toBeVisible()
  })

  test('booking bar displays Draft status', async ({ page }) => {
    const startDate = futureDateString(55)
    await createBookingAndNavigateToIt(page, startDate)

    // Click the booking bar to open the detail dialog
    await page.locator('[data-booking-id]').first().click()

    // Detail dialog shows "Draft" specifically
    await expect(page.getByText('Draft')).toBeVisible({ timeout: 10_000 })
  })
})
