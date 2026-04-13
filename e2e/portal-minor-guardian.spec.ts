import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from './helpers/auth'
import { futureDateString } from './helpers/seed'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns an ISO date string for someone who will be `age` years old on `refDate`. */
function dobForAge(age: number, refDate: string): string {
  const ref = new Date(refDate)
  return new Date(ref.getFullYear() - age, ref.getMonth(), ref.getDate())
    .toISOString()
    .slice(0, 10)
}

/** Create a booking and get the portal token (replicates the portal helper). */
async function createBookingAndGetToken(page: import('@playwright/test').Page, startDate: string): Promise<string> {
  await signInAsDiveCenter(page)

  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Full name *').fill('Minor Test Diver')
  await page.locator('[data-testid="customer-email"]').first().fill('minor.test@test.com')
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  await page.locator('[data-testid="course-activity-select"]').first().selectOption('DSD')
  await page.locator('[data-testid="course-start-date"]').first().fill(startDate)
  await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })

  const instructorSelect = page.locator('[data-testid="instructor-select"]')
  await expect(instructorSelect).toBeVisible({ timeout: 10_000 })
  await instructorSelect.click()
  await page.getByRole('option', { name: 'External (not in system)' }).click()
  await page.getByLabel('Instructor (external)').fill('External Instructor')

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Submit Booking' }).click()

  const bookingBar = page.locator('[data-booking-id]').first()
  await expect(bookingBar).toBeVisible({ timeout: 10_000 })
  await bookingBar.click()

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

/** Fill contact step with a minor's DOB. */
async function completeContactStepAsMinor(
  page: import('@playwright/test').Page,
  minorDob: string,
): Promise<void> {
  await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Legal First Name *').fill('Minor')
  await page.getByLabel('Legal Last Name *').fill('Diver')
  await page.getByLabel('Email *').fill('minor.portal@example.com')
  await page.getByLabel('Phone *').first().fill('+12025550100')
  await page.getByLabel('Date of Birth *').fill(minorDob)

  await page.locator('[data-testid="portal-gender-select"]').selectOption('M')
  await page.locator('[data-testid="portal-nationality-select"]').selectOption('United States')

  await page.getByLabel('Passport Number *').fill('MINOR12345')
  await page.locator('[data-testid="portal-issuing-country-select"]').selectOption('United States')
  await page.getByLabel('Expiration Date *').fill('2030-01-01')

  await page.getByLabel('Full Name *').fill('Parent Name')
  await page.getByLabel('Phone *').nth(1).fill('+14155550178')
  await page.getByLabel('Relationship *').fill('Parent')

  await page.getByRole('button', { name: 'Continue' }).click()
}

/** Answer all 10 medical questions "No" and submit. */
async function completeMedicalStep(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.getByText(/Medical/i).first()).toBeVisible({ timeout: 10_000 })

  const noRadios = page.locator('input[type="radio"][value="no"]')
  await expect(noRadios).toHaveCount(10, { timeout: 5_000 })
  for (let i = 0; i < 10; i++) {
    await noRadios.nth(i).click()
  }

  await page.getByRole('button', { name: 'Continue' }).click()
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('portal: minor with guardian', () => {
  test('waiver step shows guardian section for under-18 participant', async ({ page }) => {
    const startDate = futureDateString(95)
    const token = await createBookingAndGetToken(page, startDate)
    const minorDob = dobForAge(16, startDate) // 16 years old at dive date

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    await completeContactStepAsMinor(page, minorDob)
    await completeMedicalStep(page)

    // Waiver step should show guardian section
    await expect(page.getByText(/Waiver/i).first()).toBeVisible({ timeout: 10_000 })

    // Guardian section heading
    await expect(
      page.getByText('Parent / Guardian Signature'),
    ).toBeVisible({ timeout: 5_000 })

    // Guardian section explanation
    await expect(
      page.getByText(/under 18 years of age/i),
    ).toBeVisible()

    // Guardian name field
    await expect(
      page.getByLabel('Parent / Guardian Full Name'),
    ).toBeVisible()

    // Guardian signature pad (second canvas)
    const canvases = page.locator('canvas')
    await expect(canvases).toHaveCount(2, { timeout: 5_000 })
  })

  test('waiver step does NOT show guardian section for adult', async ({ page }) => {
    const startDate = futureDateString(95)
    const token = await createBookingAndGetToken(page, startDate)

    await page.goto(`${BASE_URL}/portal/${token}`)
    await expect(page).not.toHaveURL(/expired|not_found/, { timeout: 10_000 })

    // Use the standard adult contact helper (DOB = 1990-06-15)
    await expect(page.getByLabel('Legal First Name *')).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Legal First Name *').fill('Adult')
    await page.getByLabel('Legal Last Name *').fill('Diver')
    await page.getByLabel('Email *').fill('adult.portal@example.com')
    await page.getByLabel('Phone *').first().fill('+12125550180')
    await page.getByLabel('Date of Birth *').fill('1990-06-15')

    await page.locator('[data-testid="portal-gender-select"]').selectOption('F')
    await page.locator('[data-testid="portal-nationality-select"]').selectOption('United States')

    await page.getByLabel('Passport Number *').fill('ADULT12345')
    await page.locator('[data-testid="portal-issuing-country-select"]').selectOption('United States')
    await page.getByLabel('Expiration Date *').fill('2030-01-01')

    await page.getByLabel('Full Name *').fill('Emergency Contact')
    await page.getByLabel('Phone *').nth(1).fill('+12125550191')
    await page.getByLabel('Relationship *').fill('Spouse')

    await page.getByRole('button', { name: 'Continue' }).click()
    await completeMedicalStep(page)

    // Waiver step should NOT show guardian section
    await expect(page.getByText(/Waiver/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Parent / Guardian Signature')).not.toBeVisible({ timeout: 3_000 })

    // Only 1 signature canvas (participant only)
    const canvases = page.locator('canvas')
    await expect(canvases).toHaveCount(1, { timeout: 5_000 })
  })
})
