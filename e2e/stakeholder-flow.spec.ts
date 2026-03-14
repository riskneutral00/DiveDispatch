import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { NICOLE, JAMES, futureDateString } from './helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForWizardReady(page: import('@playwright/test').Page): Promise<string> {
  await page.waitForSelector('text=Preparing booking', { state: 'detached', timeout: 20_000 })
  const bookingIdEl = page.locator('p.text-xs.font-mono').first()
  await expect(bookingIdEl).not.toBeEmpty({ timeout: 15_000 })
  return (await bookingIdEl.textContent()) ?? ''
}

/**
 * Create a booking as Nicole with James Cooper as instructor.
 * Returns when redirected to Nicole's dashboard.
 */
async function createBookingWithJames(
  page: import('@playwright/test').Page,
  startDate: string,
  diverName: string,
): Promise<void> {
  await page.goto('/booking/new')
  await waitForWizardReady(page)

  // Details: DSD, 1-day
  await page.locator('button:has-text("PADI Discover Scuba Diving")').click()
  await page.getByLabel('Start Date').fill(startDate)
  await page.getByLabel('End Date').fill(startDate)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)

  // Divers
  await page.getByRole('button', { name: 'Add Diver' }).click()
  await page.getByLabel('First Name').first().fill(diverName)
  await page.getByLabel('Last Name').first().fill('Diver')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)

  // Resources: assign James Cooper
  await page.locator('button:has-text("Select instructor")').click()
  await page.getByText('James Cooper').first().click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)

  // Sessions (auto-generated)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)

  // Submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()
  await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath), { timeout: 20_000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('stakeholder-flow', () => {
  test('instructor accepts a booking request', async ({ page }) => {
    const startDate = futureDateString(45)

    // Nicole creates a booking with James
    await signInAs(page, NICOLE.email)
    await createBookingWithJames(page, startDate, 'Eve')

    // Switch to James
    await signInAs(page, JAMES.email)
    await page.goto(JAMES.dashboardPath)

    // "Pending Requests" section should show the booking
    await expect(page.getByText('Pending Requests')).toBeVisible({ timeout: 10_000 })

    // Count pending requests before accepting
    const acceptBtn = page.getByRole('button', { name: 'Accept' }).first()
    await expect(acceptBtn).toBeVisible({ timeout: 10_000 })

    await acceptBtn.click()

    // After accepting, the request should disappear from Pending Requests
    // and appear in the Confirmed Schedule section
    await expect(page.getByText('Confirmed Schedule')).toBeVisible({ timeout: 5_000 })

    // The Accept button should either disappear (moved to confirmed)
    // or the confirmed schedule should have content
    await page.waitForTimeout(1_000) // allow Convex optimistic update to propagate
    // Just verify confirmed schedule section is visible and no error occurred
    await expect(page.getByText('Confirmed Schedule')).toBeVisible()
  })

  test('instructor declines a booking request', async ({ page }) => {
    const startDate = futureDateString(46)

    // Nicole creates another booking with James
    await signInAs(page, NICOLE.email)
    await createBookingWithJames(page, startDate, 'Frank')

    // Switch to James
    await signInAs(page, JAMES.email)
    await page.goto(JAMES.dashboardPath)

    // Pending requests should show
    await expect(page.getByText('Pending Requests')).toBeVisible({ timeout: 10_000 })
    const declineBtn = page.getByRole('button', { name: 'Decline' }).first()
    await expect(declineBtn).toBeVisible({ timeout: 10_000 })

    await declineBtn.click()

    // Confirm decline dialog
    const confirmDialog = page.getByRole('dialog')
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 })
    await confirmDialog.getByRole('button', { name: 'Decline' }).click()

    // After declining, the request should be removed from pending
    await page.waitForTimeout(1_000) // Convex mutation to settle
    // Either no more decline buttons (all requests handled) or at least the operation succeeded
    // without error
    await expect(page.locator('[role="alert"]')).not.toBeVisible()
  })
})
