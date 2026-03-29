import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { NICOLE, futureDateString } from './helpers/seed'

/**
 * @pwa — PWA offline-to-online mutation replay E2E test.
 *
 * Verifies the offline indicator, Convex mutation queueing while offline,
 * and replay on reconnect. Uses the booking creation wizard as the mutation
 * surface: fills all steps while online, goes offline before final submit,
 * then comes back online and verifies the booking is applied exactly once.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fill the customer step (step 1) with a single customer. */
async function fillCustomerStep(
  page: import('@playwright/test').Page,
  name: string,
  email: string,
) {
  await page.getByLabel('Full name *').fill(name)
  await page.locator('[data-testid="customer-email"]').first().fill(email)
  await page.getByRole('button', { name: 'English' }).first().click()
}

/** Advance the wizard to the next step. */
async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(
    page.locator('[data-testid="course-activity-select"]').first()
      .or(page.getByRole('button', { name: 'Submit Booking' })),
  ).toBeVisible({ timeout: 10_000 })
}

/** Fill the itinerary step (step 2) with DSD + external instructor. */
async function fillItineraryStep(
  page: import('@playwright/test').Page,
  startDate: string,
) {
  await page.locator('[data-testid="course-activity-select"]').first().selectOption('DSD')
  await page.locator('[data-testid="course-start-date"]').first().fill(startDate)
  await expect(page.getByText(/Day 1/).first()).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('[data-testid="instructor-select"]')
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
  await instructorSelect.click()
  await page.getByRole('option', { name: 'External (not in system)' }).click()
  await page.getByLabel('Instructor (external)').fill('External Instructor')

  // Assign external pool if the select is visible (DSD day 1 = confined water)
  const poolSelect = page.locator('[data-testid="pool-select"]')
  if (await poolSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await poolSelect.selectOption('__external__')
    await page.getByLabel('Pool (external)').fill('External Pool')
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('@pwa offline-to-online mutation replay', () => {
  test('offline indicator appears when network is lost and disappears on reconnect', async ({ page }) => {
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })

    // Verify no offline indicator while online
    const offlineBanner = page.getByRole('status').filter({ hasText: 'offline' })
    await expect(offlineBanner).not.toBeVisible()

    // Go offline
    const context = page.context()
    await context.setOffline(true)

    // The offline indicator should appear — it listens to navigator.onLine via
    // the browser 'offline' event, which Playwright's setOffline triggers.
    await expect(
      page.getByText('You are offline. Showing cached data.'),
    ).toBeVisible({ timeout: 10_000 })

    // Come back online
    await context.setOffline(false)

    // The offline indicator should disappear once connectivity is restored
    await expect(
      page.getByText('You are offline. Showing cached data.'),
    ).not.toBeVisible({ timeout: 10_000 })
  })

  test('mutation submitted offline is replayed on reconnect — applied exactly once', async ({ page }) => {
    const startDate = futureDateString(60)
    const uniqueEmail = `pwa-offline-${Date.now()}@test.com`
    const customerName = 'PWA Offline Test'

    // Sign in and reach the dashboard
    await signInAs(page, NICOLE.email)
    await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath))
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })

    // Open booking overlay and fill steps 1 + 2 while online
    await page.getByRole('button', { name: /Booking/i }).click()
    await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

    // Step 1: Customer
    await fillCustomerStep(page, customerName, uniqueEmail)
    await clickNext(page)

    // Step 2: Itinerary — DSD with external instructor
    await fillItineraryStep(page, startDate)
    await clickNext(page)

    // Step 3: Review — verify we reached it before going offline
    const submitBtn = page.getByRole('button', { name: 'Submit Booking' })
    await expect(submitBtn).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 5_000 })

    // Go offline BEFORE submitting
    const context = page.context()
    await context.setOffline(true)

    // Verify offline indicator is shown
    await expect(
      page.getByText('You are offline. Showing cached data.'),
    ).toBeVisible({ timeout: 10_000 })

    // Submit the booking while offline — Convex will queue this optimistically
    await submitBtn.click()

    // Come back online — Convex will replay the queued mutation
    await context.setOffline(false)

    // Wait for the offline indicator to disappear (reconnected)
    await expect(
      page.getByText('You are offline. Showing cached data.'),
    ).not.toBeVisible({ timeout: 15_000 })

    // Wait for overlay to close after mutation succeeds
    await expect(page.getByLabel('Close dialog')).not.toBeVisible({ timeout: 15_000 })

    // Verify the booking appears on the dashboard exactly once
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 10_000 })

    // Navigate the calendar forward to the booking date (60 days out)
    // The calendar shows 2-week ranges, so we may need to click forward
    const nextBtn = page.locator('button[aria-label="Next 2 weeks"]')
    let bookingFound = false
    for (let attempt = 0; attempt < 6 && !bookingFound; attempt++) {
      const bars = page.locator('[data-booking-id]').filter({ hasText: /DSD/ })
      const count = await bars.count()
      if (count > 0) {
        bookingFound = true
        // Idempotency check: the booking should appear exactly once
        // Filter by our unique customer name to avoid matching other DSD bookings
        const matchingBars = page.locator('[data-booking-id]').filter({ hasText: customerName })
        const matchCount = await matchingBars.count()
        expect(
          matchCount,
          `Expected booking "${customerName}" to appear exactly once, found ${matchCount} (no duplicates)`,
        ).toBe(1)
        break
      }
      await nextBtn.click()
      // Wait for calendar to re-render after navigation
      await expect(page.locator('[data-testid^="cell-"]').first()).toBeVisible({ timeout: 5_000 })
    }

    expect(bookingFound, 'Booking should appear on the calendar after offline replay').toBe(true)
  })
})
