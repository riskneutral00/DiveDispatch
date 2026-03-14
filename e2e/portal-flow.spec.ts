import { test, expect } from '@playwright/test'
import { signInAs } from './helpers/auth'
import { NICOLE, futureDateString } from './helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForWizardReady(page: import('@playwright/test').Page): Promise<string> {
  await page.waitForSelector('text=Preparing booking', { state: 'detached', timeout: 20_000 })
  const bookingIdEl = page.locator('p.text-xs.font-mono').first()
  await expect(bookingIdEl).not.toBeEmpty({ timeout: 15_000 })
  return (await bookingIdEl.textContent()) ?? ''
}

/**
 * Create a minimal all-external DSD booking as Nicole.
 * Returns the internal Convex bookingId.
 */
async function createExternalBooking(
  page: import('@playwright/test').Page,
  startDate: string,
): Promise<string> {
  await page.goto('/booking/new')
  const bookingId = await waitForWizardReady(page)

  // Step 1: Details — DSD, 1-day
  await page.locator('button:has-text("PADI Discover Scuba Diving")').click()
  await page.getByLabel('Start Date').fill(startDate)
  await page.getByLabel('End Date').fill(startDate)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)

  // Step 2: Divers — add one diver
  await page.getByRole('button', { name: 'Add Diver' }).click()
  await page.getByLabel('First Name').first().fill('Test')
  await page.getByLabel('Last Name').first().fill('Diver')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)

  // Step 3: Resources — use external/freeform instructor (no in-system reservations)
  await page.locator('button:has-text("Not in system")').first().click()
  await page.getByPlaceholder('Enter instructor name').first().fill('External Instructor')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)

  // Step 4: Sessions — auto-generated
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(500)

  // Step 5: Review — submit
  await page.getByRole('button', { name: 'Submit Booking' }).click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 })

  return bookingId
}

/**
 * Draw a squiggle on the signature canvas to simulate a real signature.
 */
async function drawSignature(page: import('@playwright/test').Page, canvasIndex = 0) {
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
 * Fill the contact form with valid test data.
 */
async function fillContactForm(page: import('@playwright/test').Page) {
  await page.getByLabel('Legal First Name *').fill('Jane')
  await page.getByLabel('Legal Last Name *').fill('Customer')
  await page.getByLabel('Email *').fill('jane.customer@example.com')
  await page.getByLabel('Phone *').fill('+1 555 000 1234')
  await page.getByLabel('Date of Birth *').fill('1990-06-15')

  // Gender — standard select, default 'M' may be pre-selected; select 'F' explicitly
  await page.locator('label:has-text("Gender") ~ select').selectOption('F')

  // Nationality — select "United States"
  await page.locator('label:has-text("Nationality") ~ select').selectOption('United States')

  // Passport
  await page.getByLabel('Passport Number *').fill('AB1234567')
  await page.locator('label:has-text("Issuing Country") ~ select').selectOption('United States')
  await page.getByLabel('Expiration Date *').fill('2030-01-01')

  // Emergency contact
  await page.getByLabel('Emergency Contact Name *').fill('John Customer')
  await page.getByLabel('Emergency Contact Phone *').fill('+1 555 000 5678')
  await page.getByLabel('Emergency Contact Relation *').fill('Spouse')
}

/**
 * Answer all 10 medical questions with "No".
 */
async function fillMedicalForm(page: import('@playwright/test').Page) {
  const noRadios = page.locator('input[type="radio"][value="no"]')
  const count = await noRadios.count()
  for (let i = 0; i < count; i++) {
    await noRadios.nth(i).click()
  }
}

/**
 * Complete the waiver step: draw signature, acknowledge, choose no insurance.
 */
async function fillWaiverForm(page: import('@playwright/test').Page) {
  // Draw participant signature on the first canvas
  await drawSignature(page, 0)

  // Check acknowledgment checkbox
  await page.locator('input[type="checkbox"]').first().check()

  // Choose "No" for diver accident insurance
  await page.locator('input[type="radio"][name="hasInsurance"][value="no"]').click()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('portal-flow', () => {
  test('customer completes all portal steps and submits', async ({ page }) => {
    const startDate = futureDateString(60)

    // Step A: Create booking as operator (Nicole)
    await signInAs(page, NICOLE.email)
    const bookingId = await createExternalBooking(page, startDate)

    // Step B: Navigate to booking detail and generate portal link
    await page.goto(`/booking/${bookingId}`)

    // Click "Send Portal Link" to reveal the create form
    await page.getByRole('button', { name: 'Send Portal Link' }).click()

    // Fill customer name and email in the generate link form
    // The form shows a "Customer name" and "Customer email" field
    const customerNameInput = page.locator('label:has-text("Customer name") + input, label:has-text("Customer name") ~ input')
    await customerNameInput.fill('Jane Customer')
    const customerEmailInput = page.locator('label:has-text("Customer email") + input, label:has-text("Customer email") ~ input')
    await customerEmailInput.fill('jane.customer@example.com')

    // Generate the link
    await page.getByRole('button', { name: 'Generate Link' }).click()

    // Portal URL is now shown on the page in a font-mono element
    const portalUrlEl = page.locator('.font-mono.break-all span').first()
    await expect(portalUrlEl).toBeVisible({ timeout: 10_000 })
    const portalUrlText = await portalUrlEl.textContent()
    expect(portalUrlText).toContain('/portal/')

    // Extract the token from the URL
    const token = portalUrlText!.split('/portal/')[1]
    expect(token).toBeTruthy()

    // Step C: Navigate to the portal as a customer
    await page.goto(`/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/)

    // ── Step: Contact ─────────────────────────────────────────────────────────
    await expect(page.getByText('Contact').first()).toBeVisible({ timeout: 10_000 })
    await fillContactForm(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(1_000)

    // ── Step: Medical ─────────────────────────────────────────────────────────
    await expect(page.getByText('Medical').first()).toBeVisible({ timeout: 10_000 })
    await fillMedicalForm(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(1_000)

    // ── Step: Waiver ──────────────────────────────────────────────────────────
    await expect(page.getByText('Waiver').first()).toBeVisible({ timeout: 10_000 })
    await fillWaiverForm(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(1_000)

    // ── Step: Equipment ───────────────────────────────────────────────────────
    // Equipment step is optional — just click Continue to proceed
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(500)

    // ── Step: Submit ──────────────────────────────────────────────────────────
    await expect(page.getByText('Review').or(page.getByText('Submit')).first()).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Review & Submit' }).click()

    // ── Confirmation ──────────────────────────────────────────────────────────
    await expect(page.getByText('Submission Complete')).toBeVisible({ timeout: 20_000 })
  })
})
