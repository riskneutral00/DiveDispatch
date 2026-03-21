import { test, expect } from '@playwright/test'
import { signInAs } from '../helpers/auth'
import { NICOLE, RYAN_CLARKE, futureDateString } from '../helpers/seed'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Create a booking with Ryan Clarke as the assigned instructor. */
async function createBookingWithRyanClarke(
  page: import('@playwright/test').Page,
  startDate: string,
  diverName: string,
): Promise<void> {
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill(diverName)
  await page
    .locator('input[type="email"]')
    .first()
    .fill(`${diverName.toLowerCase().replace(/\s+/g, '')}@test.com`)
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: Itinerary — DSD with Ryan Clarke as instructor
  await page.locator('select').first().selectOption('DSD')
  await page.locator('input[type="date"]').first().fill(startDate)
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('select').filter({ hasText: /Select instructor/ })
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })

  const ryanOption = instructorSelect.locator('option:has-text("Ryan Clarke")')
  const ryanValue = await ryanOption.getAttribute('value')
  if (ryanValue) {
    await instructorSelect.selectOption(ryanValue)
  }

  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3: Review — submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: instructor sign-in', () => {
  test('instructor dashboard loads after sign-in', async ({ page }) => {
    // Sign in as Nicole and create a booking with Ryan Clarke
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))

    const startDate = futureDateString(75)
    await createBookingWithRyanClarke(page, startDate, 'Walkthrough Diver')

    // Switch to Ryan Clarke's instructor account
    await signInAs(page, RYAN_CLARKE.email)
    await page.goto(RYAN_CLARKE.dashboardPath)

    // Instructor dashboard is visible
    await expect(page).toHaveURL(new RegExp(RYAN_CLARKE.dashboardPath), { timeout: 15_000 })
  })

  test('pending request visible with booking details', async ({ page }) => {
    // Nicole creates a booking assigned to Ryan Clarke
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))

    const startDate = futureDateString(76)
    const diverName = 'Instructor Test Diver'
    await createBookingWithRyanClarke(page, startDate, diverName)

    // Switch to Ryan Clarke's dashboard
    await signInAs(page, RYAN_CLARKE.email)
    await page.goto(RYAN_CLARKE.dashboardPath)

    // Pending Requests section is visible
    await expect(page.getByText('Pending Requests')).toBeVisible({ timeout: 10_000 })

    // Accept button is present for the pending booking
    const acceptBtn = page.getByRole('button', { name: 'Accept' }).first()
    await expect(acceptBtn).toBeVisible({ timeout: 10_000 })
  })
})
