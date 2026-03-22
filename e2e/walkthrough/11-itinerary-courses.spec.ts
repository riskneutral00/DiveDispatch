import { test, expect } from '@playwright/test'
import { signInAsDiveCenter } from '../helpers/auth'
import { futureDateString } from '../helpers/seed'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Open the wizard and advance to the itinerary step. */
async function openWizardAndFillCustomers(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /Booking/i }).click()
  await expect(page.getByLabel('Full name *')).toBeVisible({ timeout: 10_000 })

  // Fill required customer fields
  await page.getByLabel('Full name *').fill('Test Diver')
  await page.locator('input[type="email"]').first().fill('testdiver@example.com')
  await page.getByRole('button', { name: 'English' }).click()

  // Advance to itinerary
  const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
  await expect(nextBtn).toBeEnabled({ timeout: 5_000 })
  await nextBtn.click()

  // Confirm we're on the itinerary step
  await expect(page.getByText('Activity')).toBeVisible({ timeout: 5_000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('walkthrough: itinerary courses step', () => {
  test('activity dropdown renders with course options', async ({ page }) => {
    await signInAsDiveCenter(page)
    await openWizardAndFillCustomers(page)

    // Activity dropdown is present
    const activitySelect = page.locator('select').first()
    await expect(activitySelect).toBeVisible({ timeout: 5_000 })

    // Has course options (DSD is a common course in Nicole's templates)
    const dsdOption = activitySelect.locator('option:has-text("DSD")')
    await expect(dsdOption).toBeAttached()

    // Other course types are available
    const owOption = activitySelect.locator('option').filter({ hasText: /OW/i })
    const count = await owOption.count()
    expect(count).toBeGreaterThan(0)
  })

  test('date picker renders and accepts selection', async ({ page }) => {
    await signInAsDiveCenter(page)
    await openWizardAndFillCustomers(page)

    // Date picker input is present
    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeVisible({ timeout: 5_000 })

    // Set a date — input accepts the value
    const futureDate = futureDateString(60)
    await dateInput.fill(futureDate)
    await expect(dateInput).toHaveValue(futureDate)
  })

  test('selecting activity + dates populates day configs', async ({ page }) => {
    await signInAsDiveCenter(page)
    await openWizardAndFillCustomers(page)

    // Select DSD course
    await page.locator('select').first().selectOption('DSD')

    // Set a future start date
    const futureDate = futureDateString(60)
    await page.locator('input[type="date"]').first().fill(futureDate)

    // Day configuration rows appear for DSD (single-day course)
    await expect(page.getByText(/Day 1/)).toBeVisible({ timeout: 5_000 })
  })
})
