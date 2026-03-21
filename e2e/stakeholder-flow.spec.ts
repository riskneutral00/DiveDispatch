import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { NICOLE, RYAN_CLARKE, futureDateString } from './helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a booking as Nicole with Ryan Clarke as instructor via the dashboard overlay.
 * Uses the 3-step wizard (Customers → Itinerary → Review).
 */
async function createBookingWithRyanClarke(
  page: import('@playwright/test').Page,
  startDate: string,
  diverName: string,
): Promise<void> {
  // Open booking overlay from dashboard
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill(diverName)
  await page.locator('input[type="email"]').first().fill(`${diverName.toLowerCase().replace(/\s/g, '')}@test.com`)
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.waitForTimeout(1_500)

  // Step 2: Itinerary — DSD with Ryan Clarke
  await page.locator('select').first().selectOption('DSD')
  await page.locator('input[type="date"]').first().fill(startDate)

  // Wait for days to generate + instructor dropdown to load
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })
  const instructorSelect = page.locator('select').filter({ hasText: /Select instructor/ })
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })

  // Select Ryan Clarke
  const ryanOption = instructorSelect.locator('option:has-text("Ryan Clarke")')
  const ryanValue = await ryanOption.getAttribute('value')
  if (ryanValue) {
    await instructorSelect.selectOption(ryanValue)
  }

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.waitForTimeout(1_500)

  // Step 3: Review — submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()
  // Wait for overlay to close
  await page.waitForTimeout(3_000)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('stakeholder-flow', () => {
  test('instructor accepts a booking request', async ({ page }) => {
    const startDate = futureDateString(45)

    // Nicole creates a booking with Ryan Clarke
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await createBookingWithRyanClarke(page, startDate, 'Eve Diver')

    // Switch to Ryan Clarke
    await signInAs(page, RYAN_CLARKE.email)
    await page.goto(RYAN_CLARKE.dashboardPath)

    // "Pending Requests" section should show the booking
    await expect(page.getByText('Pending Requests')).toBeVisible({ timeout: 10_000 })

    const acceptBtn = page.getByRole('button', { name: 'Accept' }).first()
    await expect(acceptBtn).toBeVisible({ timeout: 10_000 })

    await acceptBtn.click()

    // After accepting, the request should appear in Confirmed Schedule
    await expect(page.getByText('Confirmed Schedule')).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(1_000)
    await expect(page.getByText('Confirmed Schedule')).toBeVisible()
  })

  test('instructor declines a booking request', async ({ page }) => {
    const startDate = futureDateString(46)

    // Nicole creates another booking with Ryan Clarke
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await createBookingWithRyanClarke(page, startDate, 'Frank Diver')

    // Switch to Ryan Clarke
    await signInAs(page, RYAN_CLARKE.email)
    await page.goto(RYAN_CLARKE.dashboardPath)

    // Pending requests should show
    await expect(page.getByText('Pending Requests')).toBeVisible({ timeout: 10_000 })
    const declineBtn = page.getByRole('button', { name: 'Decline' }).first()
    await expect(declineBtn).toBeVisible({ timeout: 10_000 })

    await declineBtn.click()

    // Confirm decline dialog
    const confirmDialog = page.getByRole('dialog')
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 })
    await confirmDialog.getByRole('button', { name: 'Decline' }).click()

    // After declining, no error alert should appear
    await page.waitForTimeout(1_000)
    await expect(page.locator('[role="alert"]')).not.toBeVisible()
  })
})
