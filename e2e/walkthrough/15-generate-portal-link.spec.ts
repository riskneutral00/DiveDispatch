import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from '../helpers/auth'
import { futureDateString } from '../helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a minimal external DSD booking via the overlay and opens its detail.
 */
async function createExternalBookingAndOpenDetail(
  page: import('@playwright/test').Page,
): Promise<void> {
  const startDate = futureDateString(90)

  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill('Portal Link Diver')
  await page.locator('input[type="email"]').first().fill('portal.test@example.com')
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

  // Step 3: Review — submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()

  // Open booking detail from dashboard calendar
  const bookingBar = page.locator('[data-booking-id]').first()
  await expect(bookingBar).toBeVisible({ timeout: 10_000 })
  await bookingBar.click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: generate portal link', () => {
  test('Send Portal Link button visible in booking detail', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createExternalBookingAndOpenDetail(page)

    const sendPortalBtn = page.getByRole('button', { name: 'Send Portal Link' })
    await expect(sendPortalBtn).toBeVisible({ timeout: 8_000 })
  })

  test('operator creates booking and generates portal link', async ({ page }) => {
    await signInAsDiveCenter(page)
    await createExternalBookingAndOpenDetail(page)

    // Open the Send Portal Link dialog
    const sendPortalBtn = page.getByRole('button', { name: 'Send Portal Link' })
    await expect(sendPortalBtn).toBeVisible({ timeout: 8_000 })
    await sendPortalBtn.click()

    // Dialog opens with title
    await expect(page.getByRole('dialog', { name: /Send Portal Link/i })).toBeVisible({
      timeout: 5_000,
    })

    // Click Copy Link to generate and reveal the URL
    await page.getByRole('button', { name: 'Copy Link' }).click()

    // URL appears in font-mono div
    const urlDiv = page.locator('.font-mono.break-all')
    await expect(urlDiv).toBeVisible({ timeout: 10_000 })
    const urlText = await urlDiv.textContent()

    expect(urlText).toContain('/portal/')

    // Token is a non-empty string after /portal/
    const token = urlText!.split('/portal/')[1]?.trim()
    expect(token).toBeTruthy()
    expect(token.length).toBeGreaterThan(0)
  })
})
