import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { NICOLE, futureDateString } from './helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait for the wizard to finish initialising and return the draft bookingId. */
async function waitForWizardReady(page: import('@playwright/test').Page): Promise<string> {
  // The spinner says "Preparing booking…" while createDraftShell is in flight.
  await page.waitForSelector('text=Preparing booking', { state: 'detached', timeout: 20_000 })
  const bookingIdEl = page.locator('p.text-xs.font-mono').first()
  await expect(bookingIdEl).not.toBeEmpty({ timeout: 15_000 })
  return (await bookingIdEl.textContent()) ?? ''
}

/** Fill the Details step: choose DSD and a 1-day date range. */
async function fillDetails(page: import('@playwright/test').Page, startDate: string) {
  // Select DSD activity type (button with aria-pressed)
  await page.locator('button:has-text("PADI Discover Scuba Diving")').click()
  // Set start and end date to same day (DSD = 1+ day minimum)
  await page.getByLabel('Start Date').fill(startDate)
  await page.getByLabel('End Date').fill(startDate)
}

/** Add one diver with a given name (accordion starts open for index 0). */
async function addDiver(page: import('@playwright/test').Page, firstName: string, lastName: string) {
  await page.getByRole('button', { name: 'Add Diver' }).click()
  // Accordion row 0 is open by default
  await page.getByLabel('First Name').first().fill(firstName)
  await page.getByLabel('Last Name').first().fill(lastName)
}

/** Advance the wizard to the next step. */
async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Next' }).click()
  // Small pause for Convex saveDraftState round-trip
  await page.waitForTimeout(500)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('booking-flow', () => {
  test('operator creates a booking — happy path', async ({ page }) => {
    const startDate = futureDateString(30)

    await signInAs(page, NICOLE.email)
    await page.goto('/booking/new')

    const bookingId = await waitForWizardReady(page)
    expect(bookingId).toBeTruthy()

    // Step 1: Details
    await fillDetails(page, startDate)
    await clickNext(page)

    // Step 2: Divers
    await addDiver(page, 'Alice', 'Test')
    await clickNext(page)

    // Step 3: Resources — assign James Cooper as instructor
    await page.locator('button:has-text("Select instructor")').click()
    await page.getByText('James Cooper').first().click()
    await clickNext(page)

    // Step 4: Sessions — auto-generated from Details + Divers
    // Just click Next (sessions should be present for DSD 1-day)
    await clickNext(page)

    // Step 5: Review — verify bookingId is still shown and submit
    const reviewBookingId = await page.locator('p.text-xs.font-mono').first().textContent()
    expect(reviewBookingId).toBe(bookingId)

    await page.getByRole('button', { name: 'Submit Booking' }).click()

    // After submission, wizard redirects → /dashboard → role-specific dashboard
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath), { timeout: 20_000 })
  })

  test('booking appears in operator dashboard after creation', async ({ page }) => {
    const startDate = futureDateString(31)

    await signInAs(page, NICOLE.email)
    await page.goto('/booking/new')
    await waitForWizardReady(page)

    await fillDetails(page, startDate)
    await clickNext(page)
    await addDiver(page, 'Bob', 'Diver')
    await clickNext(page)
    // Resources: use external instructor (skip in-system)
    await page.locator('button:has-text("Instructor")').locator('..').getByRole('button', { name: 'Not in system' }).click()
    await page.getByPlaceholder('Enter instructor name').fill('Ext Instructor')
    await clickNext(page)
    await clickNext(page)

    await page.getByRole('button', { name: 'Submit Booking' }).click()
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath), { timeout: 20_000 })

    // Dashboard shows booking list with the DSD booking we just created
    await expect(page.getByText('DSD').first()).toBeVisible({ timeout: 10_000 })
  })

  test('inventory conflict: same instructor double-booked on same date', async ({ page }) => {
    const startDate = futureDateString(30)

    // Sign in as Nicole and create FIRST booking with James Cooper
    await signInAs(page, NICOLE.email)
    await page.goto('/booking/new')
    await waitForWizardReady(page)
    await fillDetails(page, startDate)
    await clickNext(page)
    await addDiver(page, 'Carol', 'Diver')
    await clickNext(page)
    await page.locator('button:has-text("Select instructor")').click()
    await page.getByText('James Cooper').first().click()
    await clickNext(page)
    await clickNext(page)
    await page.getByRole('button', { name: 'Submit Booking' }).click()
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath), { timeout: 20_000 })

    // Create SECOND booking with same instructor and same date — should conflict
    await page.goto('/booking/new')
    await waitForWizardReady(page)
    await fillDetails(page, startDate)
    await clickNext(page)
    await addDiver(page, 'Dave', 'Diver')
    await clickNext(page)
    await page.locator('button:has-text("Select instructor")').click()
    await page.getByText('James Cooper').first().click()
    await clickNext(page)
    await clickNext(page)
    await page.getByRole('button', { name: 'Submit Booking' }).click()

    // Expect an Availability conflict error (CONFLICT code from Convex)
    await expect(
      page.getByText(/conflict|unavailable|blocked/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })
})
