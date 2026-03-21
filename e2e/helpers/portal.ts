import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { signInAsDiveCenter } from './auth'
import { futureDateString } from './seed'

/**
 * Create a minimal all-external DSD booking via the dashboard overlay.
 * Waits for overlay to close after submission.
 */
async function createExternalBooking(page: Page, startDate: string): Promise<void> {
  // Open booking overlay
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill('Test Diver')
  await page.locator('input[type="email"]').first().fill('test.diver@test.com')
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
}

/**
 * Signs in as Nicole DC, creates a minimal external DSD booking,
 * opens its detail, clicks Send Portal Link → Copy Link, and returns
 * the portal token extracted from the URL.
 *
 * Throws if the booking detail or Send Portal Link button is not accessible.
 */
export async function createBookingAndGetPortalToken(page: Page): Promise<string> {
  await signInAsDiveCenter(page)

  const startDate = futureDateString(90)
  await createExternalBooking(page, startDate)

  // Open booking detail from dashboard calendar bar
  const bookingBar = page.locator('[data-booking-id]').first()
  await expect(bookingBar).toBeVisible({ timeout: 10_000 })
  await bookingBar.click()

  // Find and click Send Portal Link in the booking detail dialog
  const sendPortalBtn = page.getByRole('button', { name: 'Send Portal Link' })
  await expect(sendPortalBtn).toBeVisible({ timeout: 8_000 })
  await sendPortalBtn.click()

  // Click Copy Link — triggers createLink mutation and shows URL in .font-mono.break-all div
  await page.getByRole('button', { name: 'Copy Link' }).click()

  const urlDiv = page.locator('.font-mono.break-all')
  await expect(urlDiv).toBeVisible({ timeout: 10_000 })
  const urlText = await urlDiv.textContent()
  if (!urlText?.includes('/portal/')) throw new Error('Portal URL not found in Copy Link result')

  const token = urlText.split('/portal/')[1]?.trim()
  if (!token) throw new Error('Could not extract portal token from URL')
  return token
}

/**
 * Fill the portal contact form with valid test data and submit.
 * Waits for the medical step heading to appear after submission.
 */
export async function completeContactStep(page: Page): Promise<void> {
  await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Legal First Name *').fill('Jane')
  await page.getByLabel('Legal Last Name *').fill('Customer')
  await page.getByLabel('Email *').fill('jane.portal@example.com')
  await page.getByLabel('Phone *').first().fill('+1 555 000 1234')
  await page.getByLabel('Date of Birth *').fill('1990-06-15')

  await page.locator('label:has-text("Gender") ~ select').selectOption('F')
  await page.locator('label:has-text("Nationality") ~ select').selectOption('United States')

  await page.getByLabel('Passport Number *').fill('AB1234567')
  await page.locator('label:has-text("Issuing Country") ~ select').selectOption('United States')
  await page.getByLabel('Expiration Date *').fill('2030-01-01')

  await page.getByLabel('Full Name *').fill('John Customer')
  await page.getByLabel('Phone *').nth(1).fill('+1 555 000 5678')
  await page.getByLabel('Relationship *').fill('Spouse')

  await page.getByRole('button', { name: 'Continue' }).click()
}
