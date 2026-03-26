import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { signInAs, signInAsDiveCenter } from './auth'
import { NICOLE, RYAN_CLARKE, futureDateString } from './seed'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Booking creation ────────────────────────────────────────────────────────

/**
 * Instructor option for booking creation.
 * - `external` (default): uses "External (not in system)" with a placeholder name
 * - `{ name: string }`: selects a named in-system instructor (e.g. "Ryan Clarke")
 */
type InstructorOption = 'external' | { name: string }

/**
 * Create a minimal DSD booking via the dashboard overlay.
 * By default uses an external instructor. Pass `instructor: { name: 'Ryan Clarke' }`
 * to assign an in-system instructor instead.
 *
 * Waits for submit mutation to fire. Caller should wait for overlay close
 * or next-step visibility after calling this.
 */
export async function createExternalBooking(
  page: Page,
  startDate: string,
  options?: { name?: string; email?: string; instructor?: InstructorOption },
): Promise<void> {
  const name = options?.name ?? 'Test Diver'
  const email = options?.email ?? 'test.diver@test.com'
  const instructor = options?.instructor ?? 'external'

  // Open booking overlay
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Step 1: Customers
  await page.getByLabel('Full name *').fill(name)
  await page.locator('[data-testid="customer-email"]').first().fill(email)
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2: Itinerary -- DSD with selected instructor
  await page.locator('[data-testid="course-activity-select"]').first().selectOption('DSD')
  await page.locator('[data-testid="course-start-date"]').first().fill(startDate)
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('[data-testid="instructor-select"]')
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
  await instructorSelect.click()

  if (instructor === 'external') {
    await page.getByRole('option', { name: 'External (not in system)' }).click()
    await page.getByLabel('Instructor (external)').fill('External Instructor')
  } else {
    await page.getByRole('option', { name: instructor.name }).click()
  }

  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3: Review -- submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()
}

// ── Calendar navigation ──────────────────────────────────────────────────────

/**
 * Navigate the dashboard calendar forward (up to `maxClicks` times)
 * until at least one booking bar is visible.
 */
export async function navigateToBookingDate(
  page: Page,
  maxClicks = 3,
): Promise<void> {
  const nextBtn = page.locator('button[aria-label="Next 2 weeks"]')

  for (let i = 0; i < maxClicks; i++) {
    const count = await page.locator('[data-booking-id]').count()
    if (count > 0) break
    await nextBtn.click()
    await expect(page.locator('[data-testid^="cell-"]').first()).toBeVisible({ timeout: 5_000 })
  }

  await expect(page.locator('[data-booking-id]').first()).toBeVisible({ timeout: 10_000 })
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

// ── Upcoming sequence ──────────────────────────────────────────────────────

/**
 * Create a booking with Ryan Clarke as instructor, complete the customer
 * portal, have Ryan accept, then return to Nicole's dashboard with the
 * booking bar visible. After this function the booking is in Upcoming status.
 *
 * @param email — unique customer email for parallel safety (required)
 */
/**
 * Navigate to the portal URL for the given token and complete all steps
 * (contact, medical, waiver, equipment, submit).
 */
export async function completeAllPortalSteps(page: Page, token: string): Promise<void> {
  await page.goto(`${BASE_URL}/portal/${token}`)
  await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

  await completeContactStep(page)
  await completeMedicalStep(page)
  await completeWaiverStep(page)
  await completeEquipmentStep(page)

  await expect(
    page.getByRole('button', { name: /Submit My Forms/i }),
  ).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /Submit My Forms/i }).click()

  await expect(
    page.getByText(/Thank you|Submitted|Complete|Success/i).first(),
  ).toBeVisible({ timeout: 10_000 })
}

export async function runFullUpcomingSequence(
  page: Page,
  startDate: string,
  email?: string,
): Promise<void> {
  const customerEmail = email ?? `upcoming-${Date.now()}@test.com`

  // 1. Nicole creates booking with Ryan → get portal token
  await signInAs(page, NICOLE.email)

  await createExternalBooking(page, startDate, {
    name: 'Upcoming Test Diver',
    email: customerEmail,
    instructor: { name: 'Ryan Clarke' },
  })

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

  // 2. Customer completes all portal steps
  await page.goto(`${BASE_URL}/portal/${token}`)
  await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

  await completeContactStep(page)
  await completeMedicalStep(page)
  await completeWaiverStep(page)
  await completeEquipmentStep(page)

  await expect(
    page.getByRole('button', { name: /Submit My Forms/i }),
  ).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /Submit My Forms/i }).click()

  await expect(
    page.getByText(/Thank you|Submitted|Complete|Success/i).first(),
  ).toBeVisible({ timeout: 10_000 })

  // 3. Ryan accepts the pending request
  await signInAs(page, RYAN_CLARKE.email)
  await expect(page.getByText('Pending Requests')).toBeVisible({ timeout: 10_000 })

  const acceptBtn = page.getByRole('button', { name: 'Accept' }).first()
  await expect(acceptBtn).toBeVisible({ timeout: 10_000 })
  await acceptBtn.click()

  await expect(page.getByText('Confirmed Schedule')).toBeVisible({ timeout: 10_000 })

  // 4. Return to Nicole's dashboard and find the booking
  await signInAs(page, NICOLE.email)
  await navigateToBookingDate(page)
}
