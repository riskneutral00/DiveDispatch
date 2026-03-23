import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from './helpers/auth'
import { futureDateString } from './helpers/seed'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Create a minimal external DSD booking and return to dashboard. */
async function createDraftBooking(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill('Cancel Test Diver')
  await page.locator('input[type="email"]').first().fill('cancel.test@test.com')
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: Itinerary — DSD with external instructor
  await page.locator('select').first().selectOption('DSD')
  await page.locator('input[type="date"]').first().fill(futureDateString(80))
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('select').filter({ hasText: /Select instructor/ })
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
  await instructorSelect.selectOption('__external__')
  await page.getByLabel('Instructor (external)').fill('External Instructor')

  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3: Submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('cancel booking', () => {
  test('cancel button opens dialog, confirming cancels the booking', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createDraftBooking(page)

    // Open booking detail from dashboard
    const bookingBar = page.locator('[data-booking-id]').first()
    await expect(bookingBar).toBeVisible({ timeout: 10_000 })
    await bookingBar.click()

    // Click Cancel button in booking detail
    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first()
    await expect(cancelBtn).toBeVisible({ timeout: 8_000 })
    await cancelBtn.click()

    // Cancel dialog should appear
    await expect(page.getByText('Cancel booking')).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByText('This cannot be undone. All reservations will be released.'),
    ).toBeVisible()

    // Optional reason field is visible
    await expect(page.locator('#cancel-reason')).toBeVisible()

    // Confirm cancellation
    await page.getByRole('button', { name: 'Cancel booking' }).click()

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 })
  })

  test('Keep booking button closes dialog without cancelling', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createDraftBooking(page)

    const bookingBar = page.locator('[data-booking-id]').first()
    await expect(bookingBar).toBeVisible({ timeout: 10_000 })
    await bookingBar.click()

    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first()
    await expect(cancelBtn).toBeVisible({ timeout: 8_000 })
    await cancelBtn.click()

    // Dialog appears
    await expect(page.getByText('Cancel booking')).toBeVisible({ timeout: 5_000 })

    // Click "Keep booking"
    await page.getByRole('button', { name: 'Keep booking' }).click()

    // Dialog closes, booking detail still showing (not redirected)
    await expect(page.getByText('Cancel booking')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Booking Detail')).toBeVisible()
  })
})
