import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { signInAsDiveCenter } from './auth'
import { futureDateString } from './seed'

// ── Booking creation ────────────────────────────────────────────────────────

/**
 * Create a minimal all-external DSD booking via the dashboard overlay.
 * Waits for submit mutation to fire. Caller should wait for overlay close
 * or next-step visibility after calling this.
 */
export async function createExternalBooking(
  page: Page,
  startDate: string,
  options?: { name?: string; email?: string },
): Promise<void> {
  const name = options?.name ?? 'Test Diver'
  const email = options?.email ?? 'test.diver@test.com'

  // Open booking overlay
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill(name)
  await page.locator('[data-testid="customer-email"]').first().fill(email)
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: Itinerary -- DSD with external instructor
  await page.locator('[data-testid="course-activity-select"]').first().selectOption('DSD')
  await page.locator('[data-testid="course-start-date"]').first().fill(startDate)
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('[data-testid="instructor-select"]')
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
  await instructorSelect.click()
  await page.getByRole('option', { name: 'External (not in system)' }).click()
  await page.getByLabel('Instructor (external)').fill('External Instructor')

  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3: Review -- submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()
}

// ── Portal token ────────────────────────────────────────────────────────────

/**
 * Signs in as Nicole DC, creates a minimal external DSD booking,
 * opens its detail, clicks Send Portal Link -> Copy Link, and returns
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

  // Click Copy Link -- triggers createLink mutation and shows URL
  await page.getByRole('button', { name: 'Copy Link' }).click()

  const urlDiv = page.locator('[data-testid="portal-link-url"]')
  await expect(urlDiv).toBeVisible({ timeout: 10_000 })
  const urlText = await urlDiv.textContent()
  if (!urlText?.includes('/portal/')) throw new Error('Portal URL not found in Copy Link result')

  const token = urlText.split('/portal/')[1]?.trim()
  if (!token) throw new Error('Could not extract portal token from URL')
  return token
}

// ── Portal step helpers ─────────────────────────────────────────────────────

/**
 * Fill the portal contact form with valid test data and submit.
 */
export async function completeContactStep(page: Page): Promise<void> {
  await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Legal First Name *').fill('Jane')
  await page.getByLabel('Legal Last Name *').fill('Customer')
  await page.getByLabel('Email *').fill('jane.portal@example.com')
  await page.getByLabel('Phone *').first().fill('+1 555 000 1234')
  await page.getByLabel('Date of Birth *').fill('1990-06-15')

  await page.locator('[data-testid="portal-gender-select"]').selectOption('F')
  await page.locator('[data-testid="portal-nationality-select"]').selectOption('United States')

  await page.getByLabel('Passport Number *').fill('AB1234567')
  await page.locator('[data-testid="portal-issuing-country-select"]').selectOption('United States')
  await page.getByLabel('Expiration Date *').fill('2030-01-01')

  await page.getByLabel('Full Name *').fill('John Customer')
  await page.getByLabel('Phone *').nth(1).fill('+1 555 000 5678')
  await page.getByLabel('Relationship *').fill('Spouse')

  await page.getByRole('button', { name: 'Continue' }).click()
}

/**
 * Answer all 10 medical questions "No" and submit.
 */
export async function completeMedicalStep(page: Page): Promise<void> {
  await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })

  const noRadios = page.locator('input[type="radio"][value="no"]')
  await expect(noRadios).toHaveCount(10, { timeout: 5_000 })
  for (let i = 0; i < 10; i++) {
    await noRadios.nth(i).click()
  }

  await page.getByRole('button', { name: 'Continue' }).click()
}

/**
 * Draw a squiggle on the signature canvas to simulate a real signature.
 */
export async function drawSignature(page: Page, canvasIndex = 0): Promise<void> {
  const canvas = page.locator('canvas').nth(canvasIndex)
  await expect(canvas).toBeVisible({ timeout: 5_000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.mouse.move(cx - 40, cy)
  await page.mouse.down()
  await page.mouse.move(cx - 10, cy - 15)
  await page.mouse.move(cx + 10, cy + 15)
  await page.mouse.move(cx + 40, cy)
  await page.mouse.up()
}

/**
 * Complete the waiver step: draw signature, acknowledge, choose no insurance.
 */
export async function completeWaiverStep(page: Page): Promise<void> {
  await expect(page.getByText(/Waiver/i).first()).toBeVisible({ timeout: 10_000 })

  await drawSignature(page, 0)

  const checkbox = page.locator('input[type="checkbox"]').first()
  if (await checkbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await checkbox.check()
  }

  const noInsurance = page.locator('input[type="radio"][name="hasInsurance"][value="no"]')
  if (await noInsurance.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await noInsurance.click()
  }

  await page.getByRole('button', { name: 'Continue' }).click()
}

/**
 * Complete the equipment step (skip optional sizing fields).
 */
export async function completeEquipmentStep(page: Page): Promise<void> {
  await expect(page.getByText(/Equipment/i).first()).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Continue' }).click()
}
