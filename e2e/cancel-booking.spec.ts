import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from './helpers/auth'
import { futureDateString } from './helpers/seed'
import { createExternalBooking } from './helpers/portal'

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('cancel booking', () => {
  test('cancel button opens dialog, confirming cancels the booking', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createExternalBooking(page, futureDateString(80))

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
    await createExternalBooking(page, futureDateString(80))

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
