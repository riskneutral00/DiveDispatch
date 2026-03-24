import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { NICOLE, futureDateString } from './helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Open the booking overlay from the dashboard. */
async function openBookingOverlay(page: import('@playwright/test').Page): Promise<void> {
  // Click the "+ Booking" button on the dashboard
  await page.getByRole('button', { name: /Booking/i }).click()
  // Wait for the overlay wizard to render the customer step
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })
}

/** Fill Customer step: name, email contact, and select English language flag. */
async function fillCustomerStep(
  page: import('@playwright/test').Page,
  name: string,
  email: string,
) {
  await page.getByLabel('Full name *').fill(name)
  // Email is the default contact type — fill the contact input
  await page.locator('[data-testid="customer-email"]').first().fill(email)
  // Select English language flag
  await page.getByRole('button', { name: 'English' }).click()
}

/** Fill Itinerary step: select DSD course, set date, assign instructor. */
async function fillItineraryStep(
  page: import('@playwright/test').Page,
  startDate: string,
  options: { instructorName?: string; useExternal?: boolean; externalInstructorName?: string } = {},
) {
  // Select DSD course from the dropdown
  await page.locator('[data-testid="course-activity-select"]').first().selectOption('DSD')

  // Fill start date (end date auto-fills for DSD = same day)
  const startDateInput = page.locator('[data-testid="course-start-date"]').first()
  await startDateInput.fill(startDate)

  // Wait for days to auto-generate
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  // Assign instructor
  const instructorSelect = page.locator('[data-testid="instructor-select"]')
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })

  if (options.useExternal) {
    await instructorSelect.click()
    await page.getByRole('option', { name: 'External (not in system)' }).click()
    if (options.externalInstructorName) {
      await page.getByLabel('Instructor (external)').fill(options.externalInstructorName)
    }
  } else {
    await instructorSelect.click()

    if (options.instructorName) {
      await page.getByRole('option', { name: options.instructorName }).click()
    } else {
      // Select first available in-system instructor (skip External option)
      const allOptions = page.getByRole('option')
      const count = await allOptions.count()
      for (let i = 0; i < count; i++) {
        const text = await allOptions.nth(i).textContent()
        if (text && !text.includes('External')) {
          await allOptions.nth(i).click()
          break
        }
      }
    }
  }
}

/** Advance the wizard to the next step. */
async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.waitForTimeout(1_500)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('booking-flow', () => {
  test('operator creates a booking — happy path', async ({ page }) => {
    const startDate = futureDateString(30)

    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))

    // Open booking overlay from dashboard
    await openBookingOverlay(page)

    // Step 1: Customers
    await fillCustomerStep(page, 'Alice Test', 'alice@test.com')
    await clickNext(page)

    // Step 2: Itinerary — DSD with first available instructor
    await fillItineraryStep(page, startDate)
    await clickNext(page)

    // Step 3: Review — verify summary and submit
    await expect(page.getByText('Alice Test')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('DSD')).toBeVisible()

    await page.getByRole('button', { name: 'Submit Booking' }).click()

    // Overlay closes after submission — dashboard should still be visible
    await page.waitForTimeout(2_000)
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })
  })

  test('booking appears in operator dashboard after creation', async ({ page }) => {
    const startDate = futureDateString(31)

    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))

    await openBookingOverlay(page)

    // Step 1: Customers
    await fillCustomerStep(page, 'Bob Diver', 'bob@test.com')
    await clickNext(page)

    // Step 2: Itinerary — DSD with external instructor
    await fillItineraryStep(page, startDate, {
      useExternal: true,
      externalInstructorName: 'Ext Instructor',
    })
    await clickNext(page)

    // Step 3: Review — submit
    await page.getByRole('button', { name: 'Submit Booking' }).click()
    await page.waitForTimeout(2_000)

    // Dashboard should show DSD booking
    await expect(page.getByText('DSD').first()).toBeVisible({ timeout: 10_000 })
  })

  test('inventory conflict: same instructor double-booked on same date', async ({ page }) => {
    const startDate = futureDateString(32)

    // Sign in as Nicole and create FIRST booking with Ryan Clarke
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))

    await openBookingOverlay(page)
    await fillCustomerStep(page, 'Carol Diver', 'carol@test.com')
    await clickNext(page)
    await fillItineraryStep(page, startDate, { instructorName: 'Ryan Clarke' })
    await clickNext(page)
    await page.getByRole('button', { name: 'Submit Booking' }).click()
    await page.waitForTimeout(3_000)

    // Create SECOND booking with same instructor and same date — should conflict
    await openBookingOverlay(page)
    await fillCustomerStep(page, 'Dave Diver', 'dave@test.com')
    await clickNext(page)
    await fillItineraryStep(page, startDate, { instructorName: 'Ryan Clarke' })
    await clickNext(page)
    await page.getByRole('button', { name: 'Submit Booking' }).click()

    // Expect an Availability conflict error
    await expect(
      page.getByText(/conflict|unavailable|blocked/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
