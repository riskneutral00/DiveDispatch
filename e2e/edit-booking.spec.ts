import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from './helpers/auth'
import { futureDateString } from './helpers/seed'
import { createExternalBooking } from './helpers/portal'

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('edit booking', () => {
  test('Edit button navigates to edit wizard', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createExternalBooking(page, futureDateString(85))

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
    await expect(page.getByText(/Customer|Itinerary|Review/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('Edit wizard shows pre-filled customer data', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createExternalBooking(page, futureDateString(85), {
      name: 'Edit Test Diver',
      email: 'edit.test@test.com',
    })

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
