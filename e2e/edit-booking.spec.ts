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
  await page.getByLabel('Full name *').fill('Edit Test Diver')
  await page.locator('input[type="email"]').first().fill('edit.test@test.com')
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: Itinerary — DSD with external instructor
  await page.locator('select').first().selectOption('DSD')
  await page.locator('input[type="date"]').first().fill(futureDateString(85))
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

test.describe('edit booking', () => {
  test('Edit button navigates to edit wizard', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createDraftBooking(page)

    // Open booking detail from dashboard
    const bookingBar = page.locator('[data-booking-id]').first()
    await expect(bookingBar).toBeVisible({ timeout: 10_000 })
    await bookingBar.click()

    // Click Edit button
    const editBtn = page.getByRole('button', { name: 'Edit' })
    await expect(editBtn).toBeVisible({ timeout: 8_000 })
    await editBtn.click()

    // Should navigate to the edit page
    await expect(page).toHaveURL(/\/booking\/.*\/edit/, { timeout: 10_000 })

    // Edit wizard should load with existing booking data
    // The BookingWizard reuses the same form — verify it loaded
    await expect(page.getByText(/Customer|Itinerary|Review/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('Edit wizard shows pre-filled customer data', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createDraftBooking(page)

    const bookingBar = page.locator('[data-booking-id]').first()
    await expect(bookingBar).toBeVisible({ timeout: 10_000 })
    await bookingBar.click()

    const editBtn = page.getByRole('button', { name: 'Edit' })
    await expect(editBtn).toBeVisible({ timeout: 8_000 })
    await editBtn.click()

    await expect(page).toHaveURL(/\/booking\/.*\/edit/, { timeout: 10_000 })

    // Customer step should show the pre-filled name from the original booking
    const nameInput = page.getByLabel('Full name *')
    await expect(nameInput).toBeVisible({ timeout: 10_000 })
    await expect(nameInput).toHaveValue('Edit Test Diver')
  })
})
