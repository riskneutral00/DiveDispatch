import { test, expect } from '@playwright/test'
import { signInAs } from '../helpers/auth'
import { NICOLE, RYAN_CLARKE, futureDateString } from '../helpers/seed'
import { completeAllPortalSteps } from '../helpers/portal'

/**
 * Sign in as Nicole, create a DSD booking with Ryan Clarke at startDate,
 * then send the portal link and return the extracted token.
 */
async function createBookingWithRyanAndGetToken(
  page: import('@playwright/test').Page,
  startDate: string,
): Promise<string> {
  await signInAs(page, NICOLE.email)
  await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath.replace(/\//g, '\\/')))

  // Open booking wizard
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill('Upcoming Test Diver')
  await page.locator('[data-testid="customer-email"]').first().fill('upcoming.test@test.com')
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: Itinerary — DSD with Ryan Clarke
  await page.locator('[data-testid="course-activity-select"]').first().selectOption('DSD')
  await page.locator('[data-testid="course-start-date"]').first().fill(startDate)
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('[data-testid="instructor-select"]')
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
  await instructorSelect.click()
  await page.getByRole('option', { name: 'Ryan Clarke' }).click()

  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3: Submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()

  // Dashboard auto-navigates to show the booking bar
  const bookingBar = page.locator('[data-booking-id]').first()
  await expect(bookingBar).toBeVisible({ timeout: 10_000 })
  await bookingBar.click()

  // Send Portal Link → Copy Link → extract token
  const sendPortalBtn = page.getByRole('button', { name: 'Send Portal Link' })
  await expect(sendPortalBtn).toBeVisible({ timeout: 8_000 })
  await sendPortalBtn.click()

  await page.getByRole('button', { name: 'Copy Link' }).click()

  const urlDiv = page.locator('[data-testid="portal-link-url"]')
  await expect(urlDiv).toBeVisible({ timeout: 10_000 })
  const urlText = await urlDiv.textContent()
  if (!urlText?.includes('/portal/')) throw new Error('Portal URL not found')

  const token = urlText.split('/portal/')[1]?.trim()
  if (!token) throw new Error('Could not extract portal token')
  return token
}

// ── Shared setup: create booking, complete portal, Ryan accepts ───────────────

/**
 * Run the full sequence: Nicole creates booking with Ryan, customer completes
 * portal, Ryan accepts. Returns with Nicole signed in on her dashboard.
 * After this, the booking at startDate should be Upcoming.
 */
async function runFullUpcomingSequence(
  page: import('@playwright/test').Page,
  startDate: string,
): Promise<void> {
  // 1. Nicole creates booking with Ryan → get portal token
  const token = await createBookingWithRyanAndGetToken(page, startDate)

  // 2. Customer completes all portal steps
  await completeAllPortalSteps(page, token)

  // 3. Ryan accepts the pending request
  await signInAs(page, RYAN_CLARKE.email)
  await page.goto(RYAN_CLARKE.dashboardPath)
  await expect(page.getByText('Pending Requests')).toBeVisible({ timeout: 10_000 })

  const acceptBtn = page.getByRole('button', { name: 'Accept' }).first()
  await expect(acceptBtn).toBeVisible({ timeout: 10_000 })
  await acceptBtn.click()

  // Ryan's acceptance triggers tryAutoAdvance → booking is now Upcoming
  await expect(page.getByText('Confirmed Schedule')).toBeVisible({ timeout: 10_000 })

  // 4. Return to Nicole's dashboard
  await signInAs(page, NICOLE.email)
  await expect(page).toHaveURL(new RegExp(NICOLE.dashboardPath.replace(/\//g, '\\/')))

  // Navigate calendar to day 20 (1–2 clicks from today)
  const nextBtn = page.locator('button[aria-label="Next 2 weeks"]')
  const bookingBar = page.locator('[data-booking-id]').first()

  for (let i = 0; i < 3; i++) {
    const count = await page.locator('[data-booking-id]').count()
    if (count > 0) break
    await nextBtn.click()
    await expect(page.locator('[data-testid^="cell-"]').first()).toBeVisible({ timeout: 5_000 })
  }

  await expect(bookingBar).toBeVisible({ timeout: 10_000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: verify upcoming status', () => {
  test('DC dashboard shows booking bar after full sequence', async ({ page }) => {
    const startDate = futureDateString(20)
    await runFullUpcomingSequence(page, startDate)

    // Booking bar is visible at day 20
    await expect(page.locator('[data-booking-id]').first()).toBeVisible()
  })

  test('booking status displays as Upcoming', async ({ page }) => {
    const startDate = futureDateString(20)
    await runFullUpcomingSequence(page, startDate)

    // Click the booking bar to open the detail dialog
    await page.locator('[data-booking-id]').first().click()

    // Verify correct booking identity — customer name from createBookingWithRyanAndGetToken
    await expect(page.getByText('Upcoming Test Diver')).toBeVisible({ timeout: 10_000 })

    // Status is specifically "Upcoming" — no regex alternatives
    await expect(page.getByText('Upcoming')).toBeVisible({ timeout: 10_000 })
  })
})
